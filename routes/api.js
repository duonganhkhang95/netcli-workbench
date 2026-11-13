const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');

// Helper to load JSON
function loadData(file) {
  try {
    const raw = fs.readFileSync(path.join(dataDir, file), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error loading ${file}:`, err);
    return [];
  }
}

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'online',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'TraceDeck API'
  });
});

// Get Vendors
router.get('/vendors', (req, res) => {
  res.json(loadData('vendors.json'));
});

// Get Core Tasks
router.get('/tasks', (req, res) => {
  const category = req.query.category;
  let tasks = loadData('tasks.json');
  if (category && category !== 'ALL') {
    tasks = tasks.filter(t => t.category === category);
  }
  res.json(tasks);
});

// Get Show Commands
router.get('/show-commands', (req, res) => {
  const category = req.query.category;
  let cmds = loadData('show_commands.json');
  if (category && category !== 'ALL') {
    cmds = cmds.filter(c => c.category === category);
  }
  res.json(cmds);
});

// Get Ports Directory
router.get('/ports', (req, res) => {
  res.json(loadData('ports.json'));
});

// Get Recovery Playbooks
router.get('/recovery', (req, res) => {
  res.json(loadData('recovery.json'));
});

// Calculate Subnet API
router.post('/calculate-subnet', (req, res) => {
  const { ip, prefix } = req.body;
  if (!ip) return res.status(400).json({ error: 'Missing IP' });
  const pfx = parseInt(prefix || 24, 10);

  const ipParts = ip.split('.').map(Number);
  if (ipParts.length !== 4 || ipParts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return res.status(400).json({ error: 'Invalid IPv4' });
  }

  const ipInt = ipParts.reduce((acc, oct) => (acc << 8) + oct, 0) >>> 0;
  const maskInt = pfx === 0 ? 0 : (~0 << (32 - pfx)) >>> 0;
  const wildcardInt = (~maskInt) >>> 0;
  const netInt = (ipInt & maskInt) >>> 0;
  const bcastInt = (netInt | wildcardInt) >>> 0;

  const intToIp = (val) => [(val >>> 24) & 255, (val >>> 16) & 255, (val >>> 8) & 255, val & 255].join('.');

  res.json({
    ip,
    prefix: pfx,
    network: intToIp(netInt),
    subnetMask: intToIp(maskInt),
    wildcardMask: intToIp(wildcardInt),
    broadcast: intToIp(bcastInt),
    firstHost: pfx >= 31 ? intToIp(netInt) : intToIp(netInt + 1),
    lastHost: pfx >= 31 ? intToIp(bcastInt) : intToIp(bcastInt - 1),
    usableHosts: pfx >= 31 ? (pfx === 31 ? 2 : 1) : Math.pow(2, 32 - pfx) - 2
  });
});


// Get Console & Serial Data
router.get('/console-serial', (req, res) => {
  res.json(loadData('console_serial.json'));
});

// Get Fiber Optics & SFP Data
router.get('/fiber-optics', (req, res) => {
  res.json(loadData('fiber_optics.json'));
});


// ==========================================
// ADMIN PORTAL APIS
// ==========================================

// Verify Admin PIN (Default: netadmin2026)
const ADMIN_PIN = process.env.ADMIN_PIN || 'netadmin2026';

router.post('/admin/auth', (req, res) => {
  const { pin } = req.body;
  if (pin === ADMIN_PIN) {
    res.json({ success: true, token: 'session_' + Date.now() });
  } else {
    res.status(401).json({ success: false, error: 'Mã PIN Admin không chính xác!' });
  }
});

// Admin System Stats
router.get('/admin/stats', (req, res) => {
  const mem = process.memoryUsage();
  const tasks = loadData('tasks.json');
  const showCmds = loadData('show_commands.json');
  const ports = loadData('ports.json');
  const vendors = loadData('vendors.json');

  res.json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
    ramUsedMB: (mem.rss / 1024 / 1024).toFixed(1),
    ramHeapMB: (mem.heapUsed / 1024 / 1024).toFixed(1),
    totalTasks: tasks.length,
    totalShowCmds: showCmds.length,
    totalPorts: ports.length,
    totalVendors: Object.keys(vendors).length
  });
});

// Admin: Add or Update a Task (Persists directly into data/tasks.json)
router.post('/admin/tasks', (req, res) => {
  const newTask = req.body;
  if (!newTask.id || !newTask.title || !newTask.category) {
    return res.status(400).json({ error: 'Thiếu thông tin ID, Tiêu đề hoặc Danh mục' });
  }

  const tasksFile = path.join(dataDir, 'tasks.json');
  let tasks = loadData('tasks.json');

  const existingIdx = tasks.findIndex(t => t.id === newTask.id);
  if (existingIdx >= 0) {
    tasks[existingIdx] = newTask;
  } else {
    tasks.unshift(newTask);
  }

  try {
    fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2), 'utf8');
    res.json({ success: true, message: 'Đã lưu bài cấu hình vào hệ thống!', task: newTask });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi ghi file tasks.json: ' + err.message });
  }
});

// Admin: Delete a Task
router.delete('/admin/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  const tasksFile = path.join(dataDir, 'tasks.json');
  let tasks = loadData('tasks.json');

  tasks = tasks.filter(t => t.id !== taskId);
  try {
    fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2), 'utf8');
    res.json({ success: true, message: 'Đã xóa bài cấu hình!' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi ghi file tasks.json' });
  }
});

// Admin: Add a new Brand / Vendor (Persists directly into data/vendors.json)
router.post('/admin/vendors', (req, res) => {
  const { key, name, color } = req.body;
  if (!key || !name) return res.status(400).json({ error: 'Thiếu key hoặc tên hãng' });

  const vendorsFile = path.join(dataDir, 'vendors.json');
  let vendors = loadData('vendors.json');

  vendors[key.toLowerCase()] = {
    name,
    color: color || 'border-slate-500/30 text-slate-300 bg-slate-800/40'
  };

  try {
    fs.writeFileSync(vendorsFile, JSON.stringify(vendors, null, 2), 'utf8');
    res.json({ success: true, message: 'Đã thêm thương hiệu mới!', vendors });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi ghi file vendors.json' });
  }
});

// Admin: Backup All Database
router.get('/admin/backup-all', (req, res) => {
  const bundle = {
    timestamp: new Date().toISOString(),
    vendors: loadData('vendors.json'),
    tasks: loadData('tasks.json'),
    show_commands: loadData('show_commands.json'),
    ports: loadData('ports.json'),
    recovery: loadData('recovery.json'),
    console_serial: loadData('console_serial.json'),
    fiber_optics: loadData('fiber_optics.json')
  };
  res.setHeader('Content-Disposition', 'attachment; filename=netcli_golden_backup_' + Date.now() + '.json');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(bundle, null, 2));
});


// ==========================================
// NETWORK DIAGNOSTIC & AUTO-ANALYZER ENGINE
// ==========================================

router.post('/diagnose/analyze', (req, res) => {
  const { rawOutput, vendor } = req.body;
  if (!rawOutput || !rawOutput.trim()) {
    return res.status(400).json({ error: 'Vui lòng cung cấp nội dung output cần phân tích!' });
  }

  const text = rawOutput;
  const issues = [];

  // 1. Kiểm tra Lỗi Cáp & CRC Errors / Frame Drops
  const crcMatch = text.match(/(\d+)\s+(?:CRC|input errors|FCS-errors|align-errors|fcs-error)/i) || 
                   text.match(/CRC\s+:\s*([1-9]\d*)/i) ||
                   text.match(/(\d+)\s+CRC/i);
  if (crcMatch && parseInt(crcMatch[1], 10) > 0) {
    issues.push({
      severity: 'critical',
      category: 'Phần Cứng & Cáp',
      title: 'Phát Hiện Lỗi Cáp Mạng / CRC Errors (' + crcMatch[1] + ' lỗi)',
      location: 'Cổng giao tiếp vật lý',
      symptom: 'Gói tin bị hỏng khung kiểm tra lỗi CRC khi truyền qua cáp mạng, gây rớt gói tin và làm chậm mạng.',
      rootCause: 'Bấm đầu hạt mạng RJ45 bị lỏng/oxy hóa, cáp mạng kém chất lượng hoặc dây mạng đi quá gần nguồn điện 3 pha/cao thế gây nhiễu từ trường.',
      fixCommand: 'interface <tên_cổng>\n shutdown\n no shutdown\nexit\nclear counters <tên_cổng>',
      recommendation: 'Bấm lại 2 đầu hạt mạng RJ45 chuẩn Cat6, thay dây patch-cord mới và gõ lệnh clear counters để theo dõi lại.'
    });
  }

  // 2. Kiểm tra Cổng bị khóa Err-Disabled / BPDU Guard / Loop Protect
  if (text.match(/err-disabled|errDisable|bpdu-guard|BPDU_GUARD/i)) {
    issues.push({
      severity: 'critical',
      category: 'Bảo Mật & Spanning Tree',
      title: 'Cổng Mạng Bị Khóa Tự Động (Err-Disabled / BPDU Guard Block)',
      location: 'Cổng Access Switch',
      symptom: 'Cổng mạng bị switch tự động ngắt kết nối (Down), đèn LED cổng chuyển sang màu cam/đỏ.',
      rootCause: 'Có người cắm thiết bị mạng phụ (Router WiFi, Switch con) vào cổng Access có bật tính năng BPDU Guard, hoặc thiết bị phát hiện có vòng lặp loop.',
      fixCommand: 'interface <tên_cổng>\n shutdown\n no shutdown\nexit\n# Bật tự động mở lại sau 30s:\nerrdisable recovery cause bpduguard\nerrdisable recovery interval 30',
      recommendation: 'Rút ngay switch con hoặc cục phát WiFi cắm lậu ra khỏi cổng tường, sau đó shutdown/no shutdown để mở lại cổng.'
    });
  }

  // 3. Kiểm tra Vòng lặp mạng & Bão Broadcast (MAC Flapping Loop)
  if (text.match(/MACFLAP_NOTIF|mac-move|flapping between|bridge host moved/i)) {
    issues.push({
      severity: 'critical',
      category: 'Loop L2 & Broadcast Storm',
      title: 'BÁO ĐỘNG ĐỎ: Vòng Lặp Mạng Loop L2 (MAC Address Flapping)',
      location: 'Hạ tầng Switch nội bộ',
      symptom: 'Địa chỉ MAC bị nhảy loạn liên tục giữa các cổng mạng, đèn switch chớp loạn xạ, CPU chạm 100%, tê liệt toàn bộ mạng LAN.',
      rootCause: 'Có 2 dây cáp mạng bị cắm chéo tạo vòng tròn khép kín giữa các switch hoặc người dùng cắm 2 đầu của 1 sợi dây vào 2 cổng trên cùng 1 ổ mạng âm tường.',
      fixCommand: 'show logging | include MACFLAP\nshow mac address-table flapping record\n# Rút ngay cáp tại cổng bị flap!',
      recommendation: 'Xem log để xác định 2 cổng đang bị nhảy MAC, lập tức rút 1 trong 2 sợi dây cáp ra để ngắt vòng lặp loop.'
    });
  }

  // 4. Kiểm tra Lệch Duplex (Duplex Mismatch)
  if (text.match(/Half-duplex|late collision|half duplex/i)) {
    issues.push({
      severity: 'warning',
      category: 'Cấu Hình Port',
      title: 'Phát Hiện Lệch Chế Độ Duplex (Half-Duplex / Late Collisions)',
      location: 'Cổng Ethernet',
      symptom: 'Tốc độ truyền file cực chậm, mạng bị nghẽn ngắt quãng khi có lưu lượng tải lớn.',
      rootCause: 'Một đầu cổng đang đàm phán Full-Duplex còn đầu kia chạy Half-Duplex (do lỗi Auto-Negotiation hoặc 1 bên bị ghim tĩnh).',
      fixCommand: 'interface <tên_cổng>\n duplex full\n speed auto\nexit',
      recommendation: 'Đồng bộ cấu hình 2 đầu cổng cùng chạy Full-Duplex hoặc để Auto-Negotiation cả hai đầu.'
    });
  }

  // 5. Kiểm tra Lỗi Kẹt OSPF (Stuck in EXSTART / EXCHANGE)
  if (text.match(/EXSTART|EXCHANGE|MTU mismatch/i)) {
    issues.push({
      severity: 'critical',
      category: 'Định Tuyến OSPF',
      title: 'Láng Giềng OSPF Bị Treo (Stuck in EXSTART / EXCHANGE)',
      location: 'Interface chạy OSPF',
      symptom: 'Router không thể học được bảng định tuyến từ láng giềng OSPF dù đã gửi nhận gói Hello thành công.',
      rootCause: 'Kích thước MTU giữa 2 đầu router không bằng nhau (ví dụ: một đầu MTU 1500, đầu kia MTU 1492 hoặc 1514).',
      fixCommand: '# Cách 1: Chỉnh MTU 2 đầu bằng nhau:\ninterface <tên_cổng>\n ip mtu 1500\nexit\n# Cách 2: Tạm thời bỏ qua kiểm tra MTU:\ninterface <tên_cổng>\n ip ospf mtu-ignore\nexit',
      recommendation: 'Kiểm tra MTU thực tế của 2 router bằng lệnh show interfaces và cấu hình đồng nhất.'
    });
  }

  // 6. Kiểm tra BGP Down / Kẹt ở Active / Idle
  if (text.match(/BGP state\s*=\s*(?:Active|Idle|Connect)/i) || text.match(/State\/PfxRcd\s*:\s*(?:Active|Idle)/i)) {
    issues.push({
      severity: 'critical',
      category: 'Định Tuyến BGP',
      title: 'Phiên Kết Nối BGP Đang Bị Sập (State: Active / Idle)',
      location: 'BGP Neighbor',
      symptom: 'Không nhận được dải IP từ nhà mạng ISP hoặc Router lõi, mất kết nối liên mạng.',
      rootCause: 'Không bắt tay được phiên TCP cổng 179: Sai IP neighbor, sai Autonomous System (AS number), hoặc tường lửa chặn TCP port 179.',
      fixCommand: 'ping <IP_NEIGHBOR>\nshow ip route <IP_NEIGHBOR>\n# Kiểm tra cổng 179:\ntelnet <IP_NEIGHBOR> 179',
      recommendation: 'Kiểm tra xem đã có tuyến đường định tuyến đến IP neighbor chưa và mở Firewall permit TCP port 179.'
    });
  }

  // 7. Kiểm tra Trùng Địa Chỉ IP (IP Conflict)
  if (text.match(/IP-4-DUPADDR|duplicate IP|conflict|Address conflict/i)) {
    issues.push({
      severity: 'warning',
      category: 'Dịch Vụ IP',
      title: 'Xung Đột Địa Chỉ IP Trong Mạng (Duplicate IP Address)',
      location: 'Subnet LAN',
      symptom: 'Máy tính bị mất mạng liên tục, nhảy thông báo "Windows has detected an IP address conflict".',
      rootCause: 'Có người tự ý đặt IP tĩnh trùng với IP mà DHCP Server đã cấp cho thiết bị khác hoặc trùng với Gateway.',
      fixCommand: 'clear ip dhcp conflict *\nshow ip dhcp conflict\nshow ip arp <IP_trung>',
      recommendation: 'Tra cứu địa chỉ MAC đang tranh chấp bằng lệnh show ip arp, thu hồi IP bị kẹt và bật DHCP Snooping.'
    });
  }

  // 8. Kiểm tra Suy Hao Quang SFP Nặng (< -22 dBm hoặc Low Power Alarm)
  const opticMatch = text.match(/Rx\s+Power.*?([-\d\.]+)\s*dBm/i) || text.match(/sfp-rx-power.*?([-\d\.]+)/i);
  if (opticMatch) {
    const rxDbm = parseFloat(opticMatch[1]);
    if (rxDbm < -22) {
      issues.push({
        severity: 'critical',
        category: 'Cáp Quang SFP',
        title: 'Suy Hao Quang Cực Kỳ Nặng (Rx Power: ' + rxDbm + ' dBm)',
        location: 'Module quang SFP/SFP+',
        symptom: 'Cổng quang bị chập chờn, down/up liên tục, tỉ lệ rớt gói tin rất cao.',
        rootCause: 'Đầu suy quang bị bẩn/xước, dây nhảy quang (patchcord) bị uốn cong gập góc, hoặc mối hàn cáp quang tuyến ngoài bị rạn nứt.',
        fixCommand: 'show interfaces <tên_cổng> transceiver detail',
        recommendation: 'Dùng bút soi quang kiểm tra độ gãy gập, dùng cồn chuyên dụng lau sạch đầu nối LC và đo kiểm lại bằng máy đo công suất OTDR.'
      });
    }
  }

  // 9. Kiểm tra CPU Cao (High CPU Utilization)
  const cpuMatch = text.match(/CPU utilization.*?(\d+)%/i) || text.match(/CPU usage.*?(\d+)%/i);
  if (cpuMatch && parseInt(cpuMatch[1], 10) >= 80) {
    issues.push({
      severity: 'critical',
      category: 'Tài Nguyên Thiết Bị',
      title: 'Tải CPU Thiết Bị Chạm Ngưỡng Đỏ (' + cpuMatch[1] + '%)',
      location: 'Control Plane / CPU',
      symptom: 'Thiết bị phản hồi console cực chậm, trễ gói tin, không thể telnet/SSH mượt mà.',
      rootCause: 'Tiến trình IP Input hoặc ARP Input bị quá tải do bão Broadcast, Loop mạng hoặc bị tấn công quét cổng/DDoS từ máy tính trong mạng.',
      fixCommand: 'show processes cpu sorted | exclude 0.00%\nshow interfaces | include drop|broadcast',
      recommendation: 'Xác định tiến trình đang ngốn CPU, kích hoạt Storm-Control trên các cổng Switch Access.'
    });
  }

  // Tổng kết bệnh án
  const hasCritical = issues.some(i => i.severity === 'critical');
  const hasWarning = issues.some(i => i.severity === 'warning');

  let overallStatus = 'healthy';
  let overallMessage = 'Hệ thống hoạt động bình thường, không phát hiện dấu hiệu bất thường nào trong output!';
  if (hasCritical) {
    overallStatus = 'critical';
    overallMessage = 'CẢNH BÁO: Phát hiện ' + issues.length + ' vấn đề nghiêm trọng cần khắc phục ngay!';
  } else if (hasWarning) {
    overallStatus = 'warning';
    overallMessage = 'LƯU Ý: Phát hiện ' + issues.length + ' cảnh báo có thể tiềm ẩn nguy cơ gián đoạn dịch vụ.';
  }

  res.json({
    status: overallStatus,
    message: overallMessage,
    issuesCount: issues.length,
    issues: issues
  });
});


// Get MikroTik MTCINE Master Data
router.get('/mikrotik/mtcine', (req, res) => {
  res.json(loadData('mikrotik_mtcine.json'));
});


// ==========================================
// AI NETWORK CONFIG AUDIT & OPTIMIZER ENGINE (SSH & TELNET)
// ==========================================

function detectVendorFromLog(text, hintedVendor) {
  if (hintedVendor && hintedVendor !== 'AUTO') return hintedVendor;
  if (/\/interface|\/ip address|RouterOS|sfp-sfpplus/i.test(text)) return 'mikrotik';
  if (/config system global|config firewall policy|FortiGate/i.test(text)) return 'fortinet';
  if (/sysname\s+|system-view|display\s+current|GigabitEthernet0\/0\/|bpdu-protection/i.test(text)) return 'huawei';
  if (/set system host-name|set interfaces\s+ge-|commit/i.test(text)) return 'juniper';
  if (/gi\d+\/0\/\d+|switchport general|terminal datadump/i.test(text)) return 'ciscocbs';
  if (/1\/1\/\d+|AOS-CX|spanning-tree bpdu-guard/i.test(text)) return 'aruba';
  if (/Ruijie|RGOS/i.test(text)) return 'ruijie';
  return 'cisco';
}

function scanPhysicalAndCableHealth(text, vendor) {
  const lines = text.split(/\r?\n/);
  let currentIntf = null;
  const intfRegex = /(GigabitEthernet\d+\/\d+\/\d+|GigabitEthernet\d+\/\d+|GigabitEthernet\s+\d+\/\d+|Gi\d+\/\d+\/\d+|Gi\d+\/\d+|gi\d+\/0\/\d+|FastEthernet\d+\/\d+|TenGigabitEthernet\d+\/\d+\/\d+|ge-\d+\/\d+\/\d+|1\/1\/\d+|ether\d+|port\d+)/i;

  const faultyMap = new Map(); // intf -> { crc: 0, inputErr: 0, collisions: 0, halfDuplex: false, lowOptic: null }
  const ensure = (name) => {
    if (!faultyMap.has(name)) faultyMap.set(name, { crc: 0, inputErr: 0, collisions: 0, halfDuplex: false, lowOptic: null });
    return faultyMap.get(name);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Track current interface block header
    const intfMatch = line.match(intfRegex);
    if (intfMatch && (/^(?:interface|Physical interface|name:|GigabitEthernet|Gi\d|gi\d|FastEthernet|TenGigabitEthernet|ge-|1\/1\/|ether\d|port\d)/i.test(line) || /is (?:up|down)/i.test(line))) {
      currentIntf = intfMatch[1].replace(/\s+/g, ' ');
    }
    const targetIntf = currentIntf || (intfMatch ? intfMatch[1] : null) || 'GigabitEthernet0/1';

    // Match BOTH "<num> CRC" AND "CRC: <num>" / "FCS-Err: <num>" / "rx-fcs-error: <num>"
    const crcPatterns = [
      /(\d+)\s+(?:CRC|fcs-err(?:ors?)?|rx-fcs-error)/i,
      /(?:CRC|FCS-Err(?:ors?)?|rx-fcs-error|fcs-errors)\s*[:=]\s*(\d+)/i
    ];
    for (const re of crcPatterns) {
      const m = line.match(re);
      if (m && parseInt(m[1], 10) > 0) {
        ensure(targetIntf).crc += parseInt(m[1], 10);
      }
    }

    // Match Input Errors / Rcv-Err in both orders
    const inErrPatterns = [
      /(\d+)\s+(?:input errors|rcv-err)/i,
      /(?:input errors|rcv-err)\s*[:=]\s*(\d+)/i
    ];
    for (const re of inErrPatterns) {
      const m = line.match(re);
      if (m && parseInt(m[1], 10) > 0) {
        ensure(targetIntf).inputErr += parseInt(m[1], 10);
      }
    }

    // Match Collisions / Late Collisions / Runts
    const colPatterns = [
      /(\d+)\s+(?:late collision|collisions|runts|giants)/i,
      /(?:late collisions?|collisions|runts)\s*[:=]\s*(\d+)/i
    ];
    for (const re of colPatterns) {
      const m = line.match(re);
      if (m && parseInt(m[1], 10) > 0) {
        ensure(targetIntf).collisions += parseInt(m[1], 10);
      }
    }

    // Detect Half-Duplex (classic cable / negotiation fault)
    if (/half-duplex|duplex:\s*half/i.test(line)) {
      ensure(targetIntf).halfDuplex = true;
    }

    // Detect Optical Rx Power Danger (<= -21.0 dBm)
    const rxMatch = line.match(/(?:Rx\s*Power|Receive\s*Power|rx-power)\s*[:=]?\s*(-\d+(?:\.\d+)?)\s*dBm/i);
    if (rxMatch && parseFloat(rxMatch[1]) <= -21.0) {
      ensure(targetIntf).lowOptic = parseFloat(rxMatch[1]);
    }
  }

  return Array.from(faultyMap.entries()).map(([intf, stats]) => ({ intf, ...stats }));
}

function extractFaultyInterface(text, vendor) {
  const physicalFaults = scanPhysicalAndCableHealth(text, vendor);
  if (physicalFaults.length > 0) return physicalFaults[0].intf;
  const m = text.match(/(GigabitEthernet\d+\/\d+\/\d+|GigabitEthernet\d+\/\d+|Gi\d+\/\d+\/\d+|Gi\d+\/\d+|gi\d+\/0\/\d+|ge-\d+\/\d+\/\d+|1\/1\/\d+|ether\d+|port\d+)/i);
  if (m) return m[1];
  const defaults = {
    cisco: 'GigabitEthernet0/1', ciscocbs: 'gi1/0/1', huawei: 'GigabitEthernet0/0/1',
    juniper: 'ge-0/0/1', aruba: '1/1/1', ruijie: 'GigabitEthernet 0/1', mikrotik: 'ether1', fortinet: 'port1'
  };
  return defaults[vendor] || 'GigabitEthernet0/1';
}

function buildSmartAudit(configText, vendorHint) {
  const text = configText || '';
  const v = detectVendorFromLog(text, vendorHint);
  const physicalFaults = scanPhysicalAndCableHealth(text, v);
  const faultyIntf = extractFaultyInterface(text, v);
  const issues = [];
  const verifiedGood = [];
  let score = 100;

  const hasCrc = physicalFaults.length > 0;
  const crcCount = physicalFaults.reduce((sum, f) => sum + f.crc + f.inputErr + f.collisions, 0);
  if (hasCrc) {
    score -= Math.min(35, 15 + physicalFaults.length * 10);
    physicalFaults.forEach(pf => {
      const detailParts = [];
      if (pf.crc > 0) detailParts.push(`${pf.crc} CRC/FCS`);
      if (pf.inputErr > 0) detailParts.push(`${pf.inputErr} Input Errors`);
      if (pf.collisions > 0) detailParts.push(`${pf.collisions} Collisions/Runts`);
      if (pf.halfDuplex) detailParts.push('Half-Duplex');
      if (pf.lowOptic !== null) detailParts.push(`Quang yếu ${pf.lowOptic} dBm`);

      let fixScript = '';
      if (v === 'huawei') {
        fixScript = `interface ${pf.intf}\n` + (pf.halfDuplex ? ' undo negotiation auto\n duplex full\n' : '') + ` shutdown\n undo shutdown\nquit`;
      } else if (v === 'juniper') {
        fixScript = `set interfaces ${pf.intf} disable\ndelete interfaces ${pf.intf} disable`;
      } else if (v === 'mikrotik') {
        fixScript = `/interface ethernet disable [find name="${pf.intf}"]\n/interface ethernet enable [find name="${pf.intf}"]`;
      } else if (v === 'fortinet') {
        fixScript = `config system interface\n edit "${pf.intf}"\n  set status down\n  set status up\n next\nend`;
      } else {
        fixScript = `interface ${pf.intf}\n` + (pf.halfDuplex ? ' duplex full\n speed 1000\n' : '') + ` shutdown\n no shutdown\nexit`;
      }

      issues.push({
        severity: 'critical',
        category: 'Cáp & Cổng Mạng',
        title: `Lỗi vật lý / cáp tại ${pf.intf} (${detailParts.join(', ')})`,
        location: pf.intf,
        symptom: pf.lowOptic !== null
          ? `Tín hiệu quang thu yếu (${pf.lowOptic} dBm <= -21 dBm), dễ rớt gói và đứt kết nối.`
          : 'Mạng không ổn định, rớt gói tin, tốc độ sụt giảm hoặc đứt kết nối ngắt quãng.',
        rootCause: pf.halfDuplex
          ? 'Lệch chế độ Duplex (Half-Duplex) hoặc bấm thiếu cặp dây (chỉ ăn 4 sợi).'
          : 'Đầu bấm RJ45 lỏng/oxy hóa, cáp hỏng, nhiễu điện từ hoặc suy hao module quang.',
        fixScript,
        execPostCmd: (v === 'cisco' || v === 'aruba' || v === 'ruijie') ? `clear counters ${pf.intf}` : (v === 'huawei' ? `reset counters interface ${pf.intf}` : ''),
        recommendation: pf.lowOptic !== null
          ? `Vệ sinh đầu dây nhảy quang / kiểm tra mối hàn hoặc thay module SFP tại ${pf.intf}.`
          : `Kiểm tra và bấm lại đầu RJ45 (hoặc thay dây nhảy Cat6) tại cổng ${pf.intf}.`
      });
    });
  } else {
    verifiedGood.push('Tín hiệu truyền dẫn vật lý tốt (0 lỗi CRC, Input Errors, Collisions hay Half-Duplex).');
  }

  const hasLoop = /err-disabled|MACFLAP_NOTIF|mac-move|loop-detect|bpduguard.*triggered/i.test(text);
  if (hasLoop) {
    score -= 30;
    let fixScript = '';
    if (v === 'cisco') fixScript = `errdisable recovery cause bpduguard\nerrdisable recovery interval 30\ninterface ${faultyIntf}\n shutdown\n no shutdown\nexit`;
    else if (v === 'ciscocbs') fixScript = `errdisable recovery cause bpdu-guard\nerrdisable recovery interval 30\ninterface ${faultyIntf}\n shutdown\n no shutdown\nexit`;
    else if (v === 'huawei') fixScript = `error-down auto-recovery cause bpdu-protection interval 30\ninterface ${faultyIntf}\n shutdown\n undo shutdown\nquit`;
    else if (v === 'aruba') fixScript = `interface ${faultyIntf}\n disable\n enable\nexit`;
    else if (v === 'mikrotik') fixScript = `/interface bridge port set [find interface="${faultyIntf}"] disabled=yes\n/interface bridge port set [find interface="${faultyIntf}"] disabled=no`;
    else fixScript = `interface ${faultyIntf}\n shutdown\n no shutdown\nexit`;

    issues.push({
      severity: 'critical',
      category: 'Loop Mạng & Spanning Tree',
      title: `Phát hiện vòng lặp Loop / Khóa cổng Err-Disabled tại ${faultyIntf}`,
      location: faultyIntf,
      symptom: 'Đèn switch nháy liên tục, toàn mạng bị chậm hoặc mất kết nối ngắt quãng.',
      rootCause: 'Cắm nhầm dây tạo vòng lặp giữa 2 cổng switch hoặc cắm thiết bị gây loop.',
      fixScript,
      recommendation: `Rút dây gây vòng lặp tại ${faultyIntf} trước khi mở lại cổng.`
    });
  } else {
    verifiedGood.push('Hệ thống chuyển mạch ổn định, không phát hiện vòng lặp Loop.');
  }

  const hasBpduGuard = /bpduguard|bpdu-guard|bpdu-protection|edge-port/i.test(text);
  if (!hasBpduGuard && v !== 'fortinet' && v !== 'mikrotik') {
    score -= 10;
    let fixScript = '';
    if (v === 'cisco') fixScript = 'spanning-tree portfast default\nspanning-tree portfast bpduguard default';
    else if (v === 'ciscocbs') fixScript = 'spanning-tree mode rstp\nspanning-tree loopback-guard';
    else if (v === 'huawei') fixScript = 'stp bpdu-protection';
    else if (v === 'aruba') fixScript = `interface ${faultyIntf}\n spanning-tree bpdu-guard\n spanning-tree port-type admin-edge\nexit`;
    else if (v === 'juniper') fixScript = 'set protocols rstp interface all edge';
    else fixScript = 'spanning-tree portfast bpduguard default';

    issues.push({
      severity: 'warning',
      category: 'Phòng Ngừa Sự Cố',
      title: 'Chưa bật BPDU Guard bảo vệ chống cắm nhầm Switch/Router phụ',
      symptom: 'Nếu nhân viên tự ý cắm router WiFi hoặc switch nhỏ gây loop, toàn mạng có thể bị treo.',
      rootCause: 'Chưa kích hoạt cơ chế BPDU Guard / Protection trên các cổng truy cập.',
      fixScript,
      recommendation: 'Bật BPDU Guard để thiết bị tự động cô lập cổng khi phát hiện BPDU lạ.'
    });
  } else {
    verifiedGood.push('Đã kích hoạt cơ chế bảo vệ Spanning Tree / BPDU.');
  }

  const isTelnet = /transport input telnet|telnet server enable|service telnet/i.test(text);
  const isSnmpPublic = /snmp-server community public|snmp-agent community read public/i.test(text);
  if (isTelnet || isSnmpPublic) {
    score -= 15;
    let fixScript = '';
    if (v === 'cisco' || v === 'ruijie') fixScript = (isTelnet ? 'line vty 0 4\n transport input ssh\nexit\n' : '') + (isSnmpPublic ? 'no snmp-server community public' : '');
    else if (v === 'ciscocbs') fixScript = (isTelnet ? 'no ip telnet server\nip ssh server\n' : '') + (isSnmpPublic ? 'no snmp-server community public' : '');
    else if (v === 'huawei') fixScript = (isTelnet ? 'undo telnet server enable\nstelnet server enable\n' : '') + (isSnmpPublic ? 'undo snmp-agent community public' : '');
    else if (v === 'aruba') fixScript = (isTelnet ? 'no telnet-server\nssh server vrf default\n' : '') + (isSnmpPublic ? 'no snmp-server community public' : '');
    else if (v === 'mikrotik') fixScript = '/ip service disable telnet\n/ip service enable ssh';
    else fixScript = 'line vty 0 4\n transport input ssh\nexit';

    issues.push({
      severity: 'warning',
      category: 'An Toàn Bảo Mật',
      title: 'Đang mở giao thức quản trị không mã hóa (Telnet / SNMP public)',
      symptom: 'Mật khẩu quản trị và thông tin cấu hình truyền dạng văn bản rõ trong mạng LAN.',
      rootCause: 'Còn bật dịch vụ Telnet cũ hoặc chuỗi SNMP community mặc định "public".',
      fixScript: fixScript.trim(),
      recommendation: 'Tắt Telnet, chuyển sang SSH và gỡ bỏ SNMP community mặc định.'
    });
  } else {
    verifiedGood.push('Giao thức quản trị an toàn (không mở Telnet / SNMP mặc định).');
  }

  const hasNtp = /ntp server|sntp server|ntp-service|system ntp/i.test(text);
  if (!hasNtp) {
    score -= 10;
    let fixScript = '';
    if (v === 'cisco' || v === 'ruijie') fixScript = 'clock timezone ICT 7 0\nntp server 216.239.35.0';
    else if (v === 'ciscocbs') fixScript = 'clock timezone ICT +7\nsntp unicast client enable\nsntp server 216.239.35.0';
    else if (v === 'huawei') fixScript = 'clock timezone ICT add 07:00:00\nntp-service unicast-server vn.pool.ntp.org';
    else if (v === 'aruba') fixScript = 'clock timezone Asia/Ho_Chi_Minh\nntp server 216.239.35.0\nntp enable';
    else if (v === 'juniper') fixScript = 'set system time-zone Asia/Ho_Chi_Minh\nset system ntp server 216.239.35.0';
    else if (v === 'mikrotik') fixScript = '/system clock set time-zone-name=Asia/Ho_Chi_Minh\n/system ntp client set enabled=yes servers=vn.pool.ntp.org';
    else if (v === 'fortinet') fixScript = 'config system ntp\n set ntpsync enable\n set type custom\n config ntpserver\n  edit 1\n   set server "vn.pool.ntp.org"\n  next\n end\nend';
    else fixScript = 'ntp server 216.239.35.0';

    issues.push({
      severity: 'suboptimal',
      category: 'Thời Gian Hệ Thống',
      title: 'Chưa đồng bộ thời gian NTP (Sai lệch giờ nhật ký Syslog)',
      symptom: 'Log sự cố ghi sai thời điểm, khó đối chiếu khi kiểm tra lỗi.',
      rootCause: 'Chưa khai báo máy chủ thời gian NTP và múi giờ +7.',
      fixScript,
      recommendation: 'Đồng bộ thời gian chuẩn qua vn.pool.ntp.org.'
    });
  } else {
    verifiedGood.push('Hệ thống đã cấu hình đồng bộ thời gian NTP.');
  }

  score = Math.max(0, Math.min(100, score));
  // Build 100% Pure Executable Optimizer Script (NO comment lines, NO interactive [confirm] prompts!)
  let optLines = [];
  if (issues.length === 0) {
    optLines.push(v === 'huawei' ? 'display current-configuration' : 'show running-config');
  } else if (v === 'mikrotik') {
    issues.forEach(i => { optLines.push(i.fixScript); });
  } else if (v === 'juniper') {
    optLines.push('configure');
    issues.forEach(i => { optLines.push(i.fixScript); });
    optLines.push('commit and-quit');
  } else if (v === 'fortinet') {
    issues.forEach(i => { optLines.push(i.fixScript); });
  } else if (v === 'huawei') {
    optLines.push('system-view');
    issues.forEach(i => { optLines.push(i.fixScript); });
    optLines.push('return');
    optLines.push('save force');
  } else if (v === 'ciscocbs') {
    optLines.push('configure');
    issues.forEach(i => { optLines.push(i.fixScript); });
    optLines.push('end');
    optLines.push('write');
  } else {
    optLines.push('configure terminal');
    issues.forEach(i => { optLines.push(i.fixScript); });
    optLines.push('end');
    optLines.push('write memory');
  }

  let whatIsHappening = '';
  if (score >= 90) {
    whatIsHappening = `Thiết bị (${v.toUpperCase()}) đang hoạt động RẤT ỔN ĐỊNH! Không có lỗi CRC, không phát hiện vòng lặp Loop và cấu hình quản trị an toàn.`;
  } else if (hasLoop || hasCrc) {
    whatIsHappening = `CẢNH BÁO (${v.toUpperCase()}): Phát hiện sự cố tại cổng ${faultyIntf}! ` +
      (hasCrc ? `Đang ghi nhận ${crcCount} lỗi CRC/Input Errors. ` : '') +
      (hasLoop ? `Có dấu hiệu vòng lặp Loop / Err-Disabled. ` : '') +
      'Kịch bản Optimizer bên dưới đã tự điền đúng tên cổng và cú pháp chuẩn của hãng.';
  } else {
    whatIsHappening = `Thiết bị (${v.toUpperCase()}) đang hoạt động bình thường nhưng thiếu các lớp bảo vệ chuẩn (BPDU Guard, tắt Telnet, đồng bộ NTP).`;
  }

  const fourAnswers = [
    { q: 'Mạng hiện tại có bị sập hay mất kết nối không?', status: (hasLoop ? 'danger' : (hasCrc ? 'warning' : 'ok')), answer: hasLoop ? `Có nguy cơ mất kết nối do loop tại ${faultyIntf}!` : (hasCrc ? `Mạng không ổn định do lỗi vật lý tại ${faultyIntf}.` : 'Mạng thông suốt, truyền tải ổn định.') },
    { q: 'Cáp mạng và cổng vật lý có bị hỏng không?', status: hasCrc ? 'danger' : 'ok', answer: hasCrc ? `Cổng ${faultyIntf} đang đếm ${crcCount} lỗi CRC.` : 'Toàn bộ cáp và cổng truyền dẫn tốt.' },
    { q: 'Có ai cắm nhầm dây hay cắm trộm router con không?', status: hasLoop ? 'danger' : (hasBpduGuard ? 'ok' : 'warning'), answer: hasLoop ? `Phát hiện dấu hiệu loop tại ${faultyIntf}!` : (hasBpduGuard ? 'Đã có lớp bảo vệ BPDU.' : 'Chưa bật BPDU Guard chống cắm trộm.') },
    { q: 'Bảo mật quản trị có an toàn không?', status: (isTelnet || isSnmpPublic) ? 'warning' : 'ok', answer: (isTelnet || isSnmpPublic) ? 'Cảnh báo: Đang mở Telnet hoặc SNMP public.' : 'An toàn: Không phát hiện Telnet / SNMP mặc định.' }
  ];

  return {
    detectedVendor: v,
    detectedInterface: faultyIntf,
    healthScore: score,
    grade: score >= 90 ? 'A+ (Hoàn Hảo)' : (score >= 70 ? 'C (Cần Tối Ưu)' : 'F (Sự Cố Nghiêm Trọng)'),
    whatIsHappening,
    fourAnswers,
    verifiedGood,
    issues,
    optimizerScript: optLines.join('\n')
  };
}


// ==========================================
// REAL LIVE SSH (SHELL + KEYBOARD-INTERACTIVE) & TELNET ENGINE
// ==========================================
function normalizeMacFormats(rawMac) {
  const hex = String(rawMac || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (hex.length !== 12) return null;
  const colon = hex.match(/.{2}/g).join(':');
  const dash = hex.match(/.{2}/g).join('-');
  const dot = hex.match(/.{4}/g).join('.');
  const huaweiDash = hex.match(/.{4}/g).join('-');
  return { hex, colon, COLON: colon.toUpperCase(), dash, dot, huaweiDash };
}

function getMacLookupCmd(vendor, mac) {
  switch (vendor) {
    case 'huawei': return `display mac-address ${mac.huaweiDash}`;
    case 'juniper': return `show ethernet-switching table | match ${mac.colon}`;
    case 'aruba': return `show mac-address-table address ${mac.colon}`;
    case 'mikrotik': return `/interface bridge host print where mac-address="${mac.COLON}"`;
    case 'fortinet': return `diagnose ip arp list | grep ${mac.colon}`;
    case 'ciscocbs':
    case 'edgecore': return `show mac address-table address ${mac.colon}`;
    case 'ruijie': return `show mac-address-table address ${mac.dot}`;
    case 'cisco':
    default: return `show mac address-table address ${mac.dot}`;
  }
}

function getLiveProbeCommands(vendor) {
  switch (vendor) {
    case 'huawei': return ['screen-length 0 temporary', 'display current-configuration', 'display interface brief'];
    case 'juniper': return ['set cli screen-length 0', 'show configuration | display set', 'show interfaces terse'];
    case 'mikrotik': return ['/export terse', '/interface ethernet print stats'];
    case 'fortinet': return ['config system global', 'end', 'show system interface'];
    case 'aruba': return ['no page', 'show running-config', 'show interface'];
    case 'ciscocbs': return ['terminal datadump', 'show running-config', 'show interfaces status'];
    case 'cisco':
    default: return ['terminal length 0', 'show running-config', 'show interfaces'];
  }
}

function parseMacTraceOutput(rawOutput, mac) {
  const lines = String(rawOutput || '').split(/\r?\n/);
  const matches = [];
  const intfRe = /(TenGigabitEthernet\d+\/\d+\/\d+|GigabitEthernet\d+\/\d+\/\d+|GigabitEthernet\d+\/\d+|GigabitEthernet\s+\d+\/\d+|Gi\d+\/\d+\/\d+|Gi\d+\/\d+|gi\d+\/0\/\d+|FastEthernet\d+\/\d+|Fa\d+\/\d+|Port-channel\d+|Po\d+|Eth-Trunk\d+|GE\d+\/\d+\/\d+|ge-\d+\/\d+\/\d+|xe-\d+\/\d+\/\d+|1\/1\/\d+|ether\d+|sfp[^\s]*|bridge[^\s]*)/i;
  for (const line of lines) {
    const low = line.toLowerCase().replace(/[^0-9a-z]/g, '');
    if (low.includes(mac.hex)) {
      const mIntf = line.match(intfRe);
      const mVlan = line.match(/^\s*(\d{1,4})\s+/);
      const isStatic = /static|permanent/i.test(line);
      const port = mIntf ? mIntf[1].trim() : null;
      if (port) {
        const isUplink = /port-channel|^po\d+|eth-trunk|sfp|trunk|uplink/i.test(port);
        matches.push({
          vlan: mVlan ? mVlan[1] : 'N/A',
          port,
          type: isStatic ? 'STATIC' : 'DYNAMIC',
          isUplink,
          rawLine: line.trim()
        });
      }
    }
  }
  return matches;
}

function execTelnetCommands({ host, port, username, password, commands }) {
  return new Promise((resolve, reject) => {
    const net = require('net');
    const socket = new net.Socket();
    let buffer = '';
    let step = 0; // 0: wait user, 1: wait pass, 2: wait prompt, 3: running
    let settled = false;
    const done = (err, out) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch (e) {}
      if (err) reject(err); else resolve(out);
    };
    socket.setTimeout(10000);
    socket.on('timeout', () => done(new Error(`Telnet timeout: Không thể kết nối tới ${host}:${port || 23} trong 10 giây.`)));
    socket.on('error', (err) => done(new Error(`Lỗi kết nối Telnet (${host}:${port || 23}): ${err.message}`)));
    socket.on('data', (chunk) => {
      const str = chunk.toString('utf8');
      buffer += str;
      if (step === 2 && /login incorrect|authentication failed|bad passwords|invalid password|access denied/i.test(str)) {
        return done(new Error('Xác thực Telnet thất bại: Sai Username hoặc Password!'));
      }
      if (step === 0 && /username|login|user:/i.test(buffer)) {
        step = 1;
        socket.write(username + '\r\n');
      } else if (step <= 1 && /password:/i.test(buffer)) {
        step = 2;
        socket.write(password + '\r\n');
      } else if (step === 2 && /[>#\]]\s*$/.test(buffer.trim()) && !/password:/i.test(buffer.slice(-20))) {
        step = 3;
        let delay = 150;
        commands.forEach((cmd) => {
          setTimeout(() => socket.write(cmd + '\r\n'), delay);
          delay += 700;
        });
        setTimeout(() => done(null, buffer), delay + 1200);
      }
    });
    socket.connect(parseInt(port, 10) || 23, host);
  });
}

function execSshCommands({ host, port, username, password, commands }) {
  return new Promise((resolve, reject) => {
    let Client;
    try {
      ({ Client } = require('ssh2'));
    } catch (e) {
      return reject(new Error('Chưa cài đặt thư viện ssh2 trên Ubuntu Server. Chạy: cd /var/www/netcli && npm install --omit=dev && pm2 restart netcli'));
    }
    const conn = new Client();
    let out = '';
    let settled = false;
    const done = (err, resOut) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { conn.end(); } catch (e) {}
      if (err) reject(err); else resolve(resOut);
    };

    const timer = setTimeout(() => {
      done(new Error(`SSH timeout: Không thể kết nối tới ${host}:${port || 22} trong 12 giây.`));
    }, 12000);

    conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
      finish(prompts.map(() => password));
    });

    conn.on('ready', () => {
      // Use interactive shell so Cisco/CBS/Huawei/Ruijie switches never reject exec channel
      conn.shell({ term: 'vt100' }, (err, stream) => {
        if (err) return done(err);
        stream.on('data', (d) => { out += d.toString('utf8'); });
        stream.stderr.on('data', (d) => { out += d.toString('utf8'); });
        stream.on('close', () => done(null, out));

        let delay = 300;
        commands.forEach((cmd) => {
          setTimeout(() => {
            try { stream.write(cmd + '\n'); } catch (e) {}
          }, delay);
          delay += 700;
        });
        setTimeout(() => {
          try { stream.write('exit\n'); } catch (e) {}
          setTimeout(() => done(null, out), 600);
        }, delay + 1000);
      });
    }).on('error', (err) => {
      let msg = err.message || 'Lỗi kết nối SSH';
      if (/authentication/i.test(msg)) msg = 'Xác thực SSH thất bại: Sai Username hoặc Password!';
      else if (/ECONNREFUSED/i.test(msg)) msg = `Từ chối kết nối tại ${host}:${port || 22} (Kiểm tra đã bật SSH trên thiết bị chưa).`;
      else if (/ETIMEDOUT|EHOSTUNREACH/i.test(msg)) msg = `Không thông mạng tới ${host}:${port || 22} (Timeout / Unreachable).`;
      done(new Error(msg));
    }).connect({
      host,
      port: parseInt(port, 10) || 22,
      username,
      password,
      tryKeyboard: true,
      readyTimeout: 8000,
      algorithms: {
        kex: ['diffie-hellman-group-exchange-sha256', 'diffie-hellman-group14-sha256', 'diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1', 'ecdh-sha2-nistp256'],
        cipher: ['aes128-ctr', 'aes256-ctr', 'aes128-gcm@openssh.com', 'aes128-cbc', '3des-cbc'],
        serverHostKey: ['ssh-ed25519', 'rsa-sha2-512', 'rsa-sha2-256', 'ssh-rsa', 'ecdsa-sha2-nistp256']
      }
    });
  });
}

router.post('/diagnose/live-probe', async (req, res) => {
  const { protocol, host, port, username, password, vendor } = req.body || {};
  const proto = String(protocol || 'SSH').toUpperCase();
  if (!['SSH', 'TELNET'].includes(proto)) {
    return res.status(400).json({ success: false, error: 'Giao thức không hợp lệ (chỉ hỗ trợ SSH hoặc TELNET).' });
  }
  if (!host || !username || !password) {
    return res.status(400).json({ success: false, error: 'Vui lòng nhập đầy đủ IP thiết bị, Username và Password.' });
  }
  const vKey = vendor && vendor !== 'AUTO' ? vendor : 'cisco';
  const cmds = getLiveProbeCommands(vKey);
  try {
    const rawOutput = proto === 'TELNET'
      ? await execTelnetCommands({ host, port: port || 23, username, password, commands: cmds })
      : await execSshCommands({ host, port: port || 22, username, password, commands: cmds });
    const audit = buildSmartAudit(rawOutput, vendor || 'AUTO');
    res.json({ success: true, protocol: proto, host, rawOutput, audit });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message || 'Kết nối tới thiết bị thất bại.' });
  }
});

router.post('/diagnose/mac-trace', async (req, res) => {
  const { protocol, host, port, username, password, vendor, macAddress } = req.body || {};
  const proto = String(protocol || '').toUpperCase();
  if (!['SSH', 'TELNET'].includes(proto)) {
    return res.status(400).json({ success: false, error: 'Tính năng dò cổng theo MAC bắt buộc phải kết nối trực tiếp qua SSH hoặc Telnet vào thiết bị.' });
  }
  if (!host || !username || !password) {
    return res.status(400).json({ success: false, error: 'Vui lòng nhập đầy đủ IP thiết bị, Username và Password SSH/Telnet.' });
  }
  const mac = normalizeMacFormats(macAddress);
  if (!mac) {
    return res.status(400).json({ success: false, error: 'Địa chỉ MAC không hợp lệ. Vui lòng nhập đủ 12 ký tự Hex (VD: aa:bb:cc:dd:ee:ff).' });
  }

  const vKey = vendor || 'cisco';
  const lookupCmd = getMacLookupCmd(vKey, mac);
  const cmds = vKey === 'mikrotik' || vKey === 'fortinet' ? [lookupCmd] : ['terminal length 0', lookupCmd];

  try {
    const rawOutput = proto === 'TELNET'
      ? await execTelnetCommands({ host, port: port || 23, username, password, commands: cmds })
      : await execSshCommands({ host, port: port || 22, username, password, commands: cmds });

    const matches = parseMacTraceOutput(rawOutput, mac);
    res.json({ success: true, protocol: proto, host, vendor: vKey, macFormats: mac, commandExecuted: lookupCmd, matches, rawOutput });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message || 'Không thể kết nối tới thiết bị.', commandExecuted: lookupCmd });
  }
});

router.post('/diagnose/audit-scan', (req, res) => {
  const { configText, vendor } = req.body;
  res.json(buildSmartAudit(configText, vendor));
});

// ==========================================
// SYSTEM VERSION & CHECK FOR UPDATE APIS
// ==========================================
const APP_VERSION = '2.6.0';
const APP_BUILD_DATE = '2026-11-12';

router.get('/system/version', (req, res) => {
  res.json({
    name: 'TraceDeck',
    version: APP_VERSION,
    buildDate: APP_BUILD_DATE,
    author: 'KhangIT',
    email: 'duonganhkhang95@gmail.com',
    tiktok: '@khangdd72'
  });
});

function compareSemver(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function detectGithubRepo() {
  if (process.env.GITHUB_REPO) return process.env.GITHUB_REPO.trim();
  try {
    const { execSync } = require('child_process');
    const remoteUrl = execSync('git config --get remote.origin.url', { cwd: path.join(__dirname, '..'), timeout: 1500 }).toString().trim();
    const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/i);
    if (match) return match[1];
  } catch (e) {}
  return '';
}

router.get('/system/check-update', async (req, res) => {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  let localVersion = APP_VERSION;
  try {
    localVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || APP_VERSION;
  } catch (e) {}

  const githubRepo = detectGithubRepo();
  const result = {
    currentVersion: localVersion,
    latestVersion: localVersion,
    hasUpdate: false,
    githubRepo: githubRepo || null,
    buildDate: APP_BUILD_DATE,
    checkedAt: new Date().toISOString(),
    updateCommand: 'cd /var/www/netcli && git pull && pm2 restart netcli',
    changelog: [
      'v2.6.0: TraceDeck Raycast UI, Dynamic Island Navbar, Dark/Light Mode (Sun/Moon) & Bản quyền KhangIT.',
      'v2.5.0: Rà soát chuẩn CLI 10 hãng từ tài liệu chính thức + Bổ sung DrayTek VigorOS.'
    ]
  };

  if (githubRepo && typeof fetch === 'function') {
    for (const branch of ['main', 'master']) {
      try {
        const resp = await fetch(`https://raw.githubusercontent.com/${githubRepo}/${branch}/package.json?t=${Date.now()}`);
        if (resp.ok) {
          const remotePkg = await resp.json();
          if (remotePkg.version) {
            result.latestVersion = remotePkg.version;
            result.hasUpdate = compareSemver(remotePkg.version, localVersion) > 0;
            result.branch = branch;
          }
          break;
        }
      } catch (e) {
        result.note = 'Không thể kết nối GitHub để kiểm tra phiên bản từ xa.';
      }
    }
  } else if (!githubRepo) {
    result.note = 'Chưa phát hiện GitHub remote. Hãy clone từ GitHub hoặc đặt biến môi trường GITHUB_REPO=user/repo.';
  }
  res.json(result);
});
module.exports = router;
