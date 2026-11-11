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

module.exports = router;
