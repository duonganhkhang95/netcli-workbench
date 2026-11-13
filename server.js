const express = require('express');
const http = require('http');
const path = require('path');
const net = require('net');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 8888;

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer(app);

// ==========================================
// REAL INTERACTIVE WEB TERMINAL (XTERM.JS + WEBSOCKET SSH/TELNET)
// ==========================================
try {
  const { WebSocketServer } = require('ws');
  const wss = new WebSocketServer({ server, path: '/ws/terminal' });

  wss.on('connection', (ws) => {
    let sshConn = null;
    let sshStream = null;
    let telnetSock = null;

    const sendJson = (obj) => {
      if (ws.readyState === 1) {
        try { ws.send(JSON.stringify(obj)); } catch (e) {}
      }
    };

    const cleanup = () => {
      try { if (sshStream) sshStream.end(); } catch (e) {}
      try { if (sshConn) sshConn.end(); } catch (e) {}
      try { if (telnetSock) telnetSock.destroy(); } catch (e) {}
      sshStream = null;
      sshConn = null;
      telnetSock = null;
    };

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (e) { return; }

      if (msg.type === 'connect') {
        cleanup();
        const proto = String(msg.protocol || 'SSH').toUpperCase();
        const host = String(msg.host || '').trim();
        const port = parseInt(msg.port, 10) || (proto === 'TELNET' ? 23 : 22);
        const username = String(msg.username || '').trim();
        const password = String(msg.password || '');
        const cols = parseInt(msg.cols, 10) || 100;
        const rows = parseInt(msg.rows, 10) || 28;

        if (!host) {
          return sendJson({ type: 'error', message: 'Thiếu địa chỉ IP thiết bị.' });
        }

        if (proto === 'TELNET') {
          sendJson({ type: 'data', data: `\r\n\x1b[36m[TraceDeck Terminal] Đang mở kết nối Telnet tới ${host}:${port}...\x1b[0m\r\n` });
          telnetSock = new net.Socket();
          telnetSock.setTimeout(15000);
          telnetSock.on('connect', () => {
            telnetSock.setTimeout(0);
            sendJson({ type: 'status', state: 'connected', protocol: 'TELNET', host, port });
          });
          telnetSock.on('data', (chunk) => {
            // Strip basic Telnet IAC negotiation bytes (0xFF .. ..) and reply WONT/DONT cleanly
            const out = [];
            for (let i = 0; i < chunk.length; i++) {
              if (chunk[i] === 0xFF && i + 2 < chunk.length) {
                const cmd = chunk[i + 1];
                const opt = chunk[i + 2];
                if (cmd === 0xFD) telnetSock.write(Buffer.from([0xFF, 0xFC, opt])); // DO -> WONT
                else if (cmd === 0xFB) telnetSock.write(Buffer.from([0xFF, 0xFE, opt])); // WILL -> DONT
                i += 2;
              } else {
                out.push(chunk[i]);
              }
            }
            if (out.length > 0) {
              sendJson({ type: 'data', data: Buffer.from(out).toString('utf8') });
            }
          });
          telnetSock.on('timeout', () => {
            sendJson({ type: 'error', message: `Telnet timeout: Không thể kết nối tới ${host}:${port}` });
            cleanup();
          });
          telnetSock.on('error', (err) => {
            sendJson({ type: 'error', message: `Lỗi Telnet (${host}:${port}): ${err.message}` });
            cleanup();
          });
          telnetSock.on('close', () => {
            sendJson({ type: 'status', state: 'disconnected' });
            cleanup();
          });
          telnetSock.connect(port, host);
        } else {
          let Client;
          try {
            ({ Client } = require('ssh2'));
          } catch (e) {
            return sendJson({ type: 'error', message: 'Chưa cài thư viện ssh2. Chạy: cd /var/www/netcli && npm install --omit=dev && pm2 restart netcli' });
          }

          if (!username || !password) {
            return sendJson({ type: 'error', message: 'Vui lòng nhập đầy đủ Username và Password SSH.' });
          }

          sendJson({ type: 'data', data: `\r\n\x1b[36m[TraceDeck Terminal] Đang mở phiên SSH tới ${username}@${host}:${port}...\x1b[0m\r\n` });
          sshConn = new Client();
          sshConn.on('keyboard-interactive', (name, instr, lang, prompts, finish) => {
            finish(prompts.map(() => password));
          });
          sshConn.on('ready', () => {
            sshConn.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
              if (err) {
                sendJson({ type: 'error', message: `Không thể mở PTY shell: ${err.message}` });
                return cleanup();
              }
              sshStream = stream;
              sendJson({ type: 'status', state: 'connected', protocol: 'SSH', host, port });
              stream.on('data', (d) => sendJson({ type: 'data', data: d.toString('utf8') }));
              stream.stderr.on('data', (d) => sendJson({ type: 'data', data: d.toString('utf8') }));
              stream.on('close', () => {
                sendJson({ type: 'status', state: 'disconnected' });
                cleanup();
              });
            });
          }).on('error', (err) => {
            let emsg = err.message || 'Lỗi kết nối SSH';
            if (/authentication/i.test(emsg)) emsg = 'Xác thực SSH thất bại: Sai Username hoặc Password!';
            else if (/ECONNREFUSED/i.test(emsg)) emsg = `Từ chối kết nối tại ${host}:${port} (Kiểm tra dịch vụ SSH trên thiết bị).`;
            else if (/ETIMEDOUT|EHOSTUNREACH/i.test(emsg)) emsg = `Không thông mạng tới ${host}:${port} (Timeout / Unreachable).`;
            sendJson({ type: 'error', message: emsg });
            sendJson({ type: 'status', state: 'disconnected' });
            cleanup();
          }).connect({
            host,
            port,
            username,
            password,
            tryKeyboard: true,
            readyTimeout: 10000,
            algorithms: {
              kex: ['diffie-hellman-group-exchange-sha256', 'diffie-hellman-group14-sha256', 'diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1', 'ecdh-sha2-nistp256'],
              cipher: ['aes128-ctr', 'aes256-ctr', 'aes128-gcm@openssh.com', 'aes128-cbc', '3des-cbc'],
              serverHostKey: ['ssh-ed25519', 'rsa-sha2-512', 'rsa-sha2-256', 'ssh-rsa', 'ecdsa-sha2-nistp256']
            }
          });
        }
      } else if (msg.type === 'input') {
        if (sshStream) sshStream.write(msg.data);
        else if (telnetSock && !telnetSock.destroyed) telnetSock.write(msg.data);
      } else if (msg.type === 'resize') {
        if (sshStream && msg.cols && msg.rows) {
          try { sshStream.setWindow(msg.rows, msg.cols, 0, 0); } catch (e) {}
        }
      } else if (msg.type === 'disconnect') {
        cleanup();
        sendJson({ type: 'status', state: 'disconnected' });
      }
    });

    ws.on('close', cleanup);
  });
  console.log('⚡ Real Interactive WebSocket Terminal (/ws/terminal) enabled!');
} catch (e) {
  console.warn('⚠️ WebSocket module (ws) not installed yet. Run npm install --omit=dev to enable live Xterm.js terminal.');
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('======================================================');
  console.log('🚀 TraceDeck Node.js Workbench running!');
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log('======================================================');
});
