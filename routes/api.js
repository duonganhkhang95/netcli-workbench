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
    service: 'NetCLI Enterprise Workbench API'
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

module.exports = router;
