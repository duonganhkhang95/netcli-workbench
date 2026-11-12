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

router.post('/diagnose/audit-scan', (req, res) => {
  const { configText, protocol, ip, vendor } = req.body;
  const text = configText || '';
  
  const issues = [];
  const verifiedGood = [];
  let score = 100;

  // 1. Phân tích lỗi cáp & truyền dẫn CRC
  const crcMatch = text.match(/(\d+)\s+(?:CRC|input errors)/i);
  let hasCrc = false;
  let crcCount = 0;
  if (crcMatch && parseInt(crcMatch[1], 10) > 0) {
    hasCrc = true;
    crcCount = parseInt(crcMatch[1], 10);
    score -= 25;
    issues.push({
      severity: 'critical',
      category: 'Cáp & Cổng Mạng',
      title: 'Đang bị lỗi bấm dây mạng hoặc cáp hỏng (' + crcCount + ' lỗi CRC)',
      location: 'Cổng giao tiếp',
      symptom: 'Mạng bị chập chờn, tải file bị rớt, độ trễ giật lag bất thường.',
      rootCause: 'Bấm đầu hạt mạng RJ45 bị lỏng chân tiếp xúc, hoặc dây cáp mạng đi chung ống với dây điện 3 pha gây nhiễu từ.',
      fixScript: 'interface <cổng_lỗi>\n shutdown\n no shutdown\n clear counters <cổng_lỗi>\nexit',
      recommendation: 'Bấm lại đầu mạng RJ45 mới và đổi sang dây cáp Cat6 chuẩn.'
    });
  } else {
    verifiedGood.push('Cáp mạng và tín hiệu truyền dẫn vật lý rất tốt (0 lỗi CRC, không rớt gói).');
  }

  // 2. Phân tích Loop L2 & Cổng bị khóa
  let hasLoop = false;
  if (text.match(/err-disabled|MACFLAP_NOTIF|mac-move/i)) {
    hasLoop = true;
    score -= 30;
    issues.push({
      severity: 'critical',
      category: 'Loop Mạng & Spanning Tree',
      title: 'Đang bị vòng lặp mạng (Loop) hoặc có cổng bị Switch tự khóa ngắt',
      symptom: 'Đèn switch chớp loạn xạ, mạng toàn bộ công ty có thể bị tê liệt ngắt quãng do bão Broadcast.',
      rootCause: 'Có người cắm nhầm dây mạng tạo thành vòng tròn giữa 2 switch, hoặc cắm router WiFi con vào mạng.',
      fixScript: 'errdisable recovery cause bpduguard\nerrdisable recovery interval 30\ninterface <cổng_bị_loop>\n shutdown\n no shutdown\nexit',
      recommendation: 'Rút ngay sợi dây cắm nhầm và bật tính năng BPDU Guard.'
    });
  } else {
    verifiedGood.push('Hệ thống chuyển mạch ổn định, không phát hiện vòng lặp Loop hay bão Broadcast.');
  }

  // 3. Phân tích tính năng chống cắm nhầm BPDU Guard
  let hasBpduGuard = text.match(/bpduguard|bpdu-guard|bpdu-protection/i);
  if (!hasBpduGuard) {
    score -= 10;
    issues.push({
      severity: 'warning',
      category: 'Phòng Ngừa Sự Cố',
      title: 'Chưa có lớp bảo vệ chống nhân viên tự cắm router WiFi lậu',
      symptom: 'Hiện tại chưa bị sập, nhưng bất kỳ ai cắm nhầm router WiFi con vào tường đều có thể làm sập switch của bạn!',
      rootCause: 'Chưa bật tính năng BPDU Guard trên các cổng cắm máy tính.',
      fixScript: 'spanning-tree portfast bpduguard default\nspanning-tree portfast default',
      recommendation: 'Bật BPDU Guard toàn cục để switch tự khóa cổng nếu phát hiện có người cắm router phụ.'
    });
  } else {
    verifiedGood.push('Đã bật tính năng bảo vệ tự động chống cắm nhầm router con (BPDU Guard).');
  }

  // 4. Phân tích an toàn bảo mật
  let isTelnet = text.match(/transport input telnet/i);
  let isSnmpPublic = text.match(/snmp-server community public/i);
  if (isTelnet || isSnmpPublic) {
    score -= 15;
    issues.push({
      severity: 'warning',
      category: 'An Toàn Bảo Mật',
      title: 'Đang mở cửa cho hacker nhìn trộm mật khẩu (Telnet / SNMP public)',
      symptom: 'Mật khẩu quản trị truyền đi không được mã hóa, ai cùng mạng LAN cũng có thể bắt được mật khẩu.',
      rootCause: 'Vẫn còn bật giao thức Telnet cũ hoặc để pass SNMP mặc định là "public".',
      fixScript: 'line vty 0 4\n transport input ssh\nexit\nno snmp-server community public',
      recommendation: 'Khóa cổng Telnet, chuyển hoàn toàn sang SSH mã hóa an toàn.'
    });
  } else {
    verifiedGood.push('Giao thức quản trị an toàn (đã chặn Telnet không mã hóa).');
  }

  // 5. Phân tích đồng bộ giờ NTP
  let hasNtp = text.match(/ntp server|sntp server/i);
  if (!hasNtp) {
    score -= 10;
    issues.push({
      severity: 'suboptimal',
      category: 'Thời Gian Hệ Thống',
      title: 'Đồng hồ thiết bị bị sai giờ (Chưa đồng bộ giờ quốc gia)',
      symptom: 'Nhật ký lỗi ghi sai ngày giờ, gây khó khăn khi điều tra sự cố.',
      rootCause: 'Chưa khai báo máy chủ đồng bộ thời gian NTP.',
      fixScript: 'clock timezone ICT 7 0\nntp server vn.pool.ntp.org\nntp server 1.1.1.1',
      recommendation: 'Đồng bộ giờ với vn.pool.ntp.org để nhật ký luôn chuẩn xác theo giờ Việt Nam.'
    });
  } else {
    verifiedGood.push('Đồng hồ hệ thống đã được đồng bộ chính xác với máy chủ giờ quốc gia.');
  }

  score = Math.max(0, Math.min(100, score));

  // Tạo lời giải thích bằng Tiếng Việt đời thường, dễ hiểu nhất
  let whatIsHappening = '';
  if (score >= 90) {
    whatIsHappening = 'Thiết bị của bạn đang trong trạng thái RẤT TỐT VÀ KHỎE MẠNH! Không có hiện tượng nghẽn mạng, cáp truyền dẫn 0 lỗi, không bị loop và không có ai tấn công phá hoại. Bạn có thể hoàn toàn yên tâm!';
  } else if (hasLoop || hasCrc) {
    whatIsHappening = 'CẢNH BÁO SỰ CỐ: Thiết bị của bạn ĐANG CÓ VẤN ĐỀ TRUYỀN DẪN! Cụ thể: ' + 
      (hasCrc ? ('Dây mạng đang bị lỗi bấm hạt hoặc đứt ngầm (' + crcCount + ' lỗi CRC) gây chập chờn rớt mạng. ') : '') +
      (hasLoop ? 'Đang có hiện tượng cắm nhầm dây tạo vòng lặp Loop L2 làm switch bị quá tải. ' : '') + 
      'Hãy bấm ngay nút "KÍCH HOẠT OPTIMIZER" bên dưới để lấy lệnh sửa ngay!';
  } else {
    whatIsHappening = 'Thiết bị vẫn đang truyền tải mạng được, nhưng CẤU HÌNH CÒN NHIỀU KẼ HỞ CHƯA AN TOÀN (chưa có lớp bảo vệ chống cắm router con, chưa khóa Telnet, chưa đồng bộ giờ). Nếu không tối ưu, khi có sự cố bất ngờ thiết bị sẽ rất dễ bị tê liệt.';
  }

  // Trả lời trực diện 4 câu hỏi sống còn của người quản trị
  const fourAnswers = [
    {
      q: 'Mạng hiện tại có bị sập hay mất kết nối không?',
      status: (hasLoop ? 'danger' : (hasCrc ? 'warning' : 'ok')),
      answer: hasLoop ? 'Có nguy cơ sập mạng do phát hiện hiện tượng vòng lặp loop!' : (hasCrc ? 'Mạng không sập nhưng bị chập chờn do lỗi cáp vật lý.' : 'Mạng đang thông suốt hoàn toàn, truyền tải ổn định.')
    },
    {
      q: 'Cáp mạng và cổng vật lý có bị hỏng không?',
      status: hasCrc ? 'danger' : 'ok',
      answer: hasCrc ? ('Có cổng đang đếm ' + crcCount + ' lỗi CRC (bấm đầu cáp hỏng hoặc dây kém chất lượng).') : 'Toàn bộ cáp mạng và cổng đều truyền dẫn tốt, không bị lỗi frame.'
    },
    {
      q: 'Có ai cắm nhầm dây hay cắm trộm router con làm loạn mạng không?',
      status: hasLoop ? 'danger' : (hasBpduGuard ? 'ok' : 'warning'),
      answer: hasLoop ? 'CẢNH BÁO: Đang có dấu hiệu cắm nhầm tạo loop!' : (hasBpduGuard ? 'Đã có lớp bảo vệ an toàn, không bị cắm trộm.' : 'Chưa có lớp bảo vệ BPDU Guard, rất dễ bị cắm trộm router con!')
    },
    {
      q: 'Bảo mật thiết bị có bị hacker nhìn trộm mật khẩu không?',
      status: (isTelnet || isSnmpPublic) ? 'warning' : 'ok',
      answer: (isTelnet || isSnmpPublic) ? 'Cảnh báo: Đang mở Telnet không mã hóa, mật khẩu có thể bị bắt lén qua Wireshark.' : 'An toàn: Đã mã hóa bảo mật đường truyền quản trị.'
    }
  ];

  // Kịch bản Optimizer sửa lỗi
  let optLines = [
    '! ========================================================',
    '! KỊCH BẢN OPTIMIZER - TỰ ĐỘNG SỬA TOÀN BỘ VẤN ĐỀ TRÊN',
    '! Dán trực tiếp vào cổng Console / SSH của thiết bị',
    '! ========================================================',
    'configure terminal',
    ''
  ];

  issues.forEach(iss => {
    optLines.push('! Khắc phục: ' + iss.title);
    optLines.push(iss.fixScript);
    optLines.push('');
  });

  optLines.push('! Lưu cấu hình an toàn vào bộ nhớ Flash:');
  optLines.push('write memory');

  res.json({
    healthScore: score,
    grade: score >= 90 ? 'A+ (Hoàn Hảo)' : (score >= 70 ? 'C (Cần Tối Ưu)' : 'F (Sự Cố Nghiêm Trọng)'),
    whatIsHappening: whatIsHappening,
    fourAnswers: fourAnswers,
    verifiedGood: verifiedGood,
    issues: issues,
    optimizerScript: optLines.join('\n')
  });
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
