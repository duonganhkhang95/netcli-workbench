// ==========================================
// NETCLI ENTERPRISE WORKBENCH CLIENT (NODE.JS / REST API)
// ==========================================

let VENDORS_INFO = {};
let CORE_TASKS = [];
let ROSETTA_DATA = [];
let NETWORK_PORTS_DATA = [];
let RECOVERY_PLAYBOOK_DATA = [];
let SHOW_COMMANDS_DATA = [];
let CONSOLE_SERIAL_DATA = [];
let FIBER_OPTICS_DATA = {};

let activeCategory = 'ALL';
let activeVendor = 'ALL';
let searchQuery = '';
let customSnippets = [];

let activeShowCategory = 'ALL';
let showSearchQuery = '';

// Load custom snippets from localStorage safely
try {
  const stored = localStorage.getItem('netcli_custom_snippets');
  if (stored) customSnippets = JSON.parse(stored);
} catch (e) {
  console.warn('Cannot read localStorage', e);
}

// Fetch all datasets from Node.js Express REST API in parallel
async function fetchAllData() {
  try {
    const [vendorsRes, tasksRes, showRes, portsRes, recoveryRes, consoleRes, fiberRes] = await Promise.all([
      fetch('/api/vendors').then(r => r.json()),
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/show-commands').then(r => r.json()),
      fetch('/api/ports').then(r => r.json()),
      fetch('/api/recovery').then(r => r.json()),
      fetch('/api/console-serial').then(r => r.json()),
      fetch('/api/fiber-optics').then(r => r.json())
    ]);

    CONSOLE_SERIAL_DATA = consoleRes;
    FIBER_OPTICS_DATA = fiberRes;

    VENDORS_INFO = vendorsRes;
    CORE_TASKS = tasksRes;
    SHOW_COMMANDS_DATA = showRes;
    NETWORK_PORTS_DATA = portsRes;
    RECOVERY_PLAYBOOK_DATA = recoveryRes;

    // Build Rosetta Data from show commands or tasks
    ROSETTA_DATA = [
      { task: 'Xem cấu hình hiện tại', cisco: 'show running-config', ciscocbs: 'show running-config', juniper: 'show configuration', fortinet: 'show full-configuration', huawei: 'display current-configuration', mikrotik: '/export verbose', ruijie: 'show running-config', edgecore: 'show running-config' },
      { task: 'Lưu cấu hình', cisco: 'write memory', ciscocbs: 'write memory', juniper: 'commit', fortinet: '(Tự động lưu khi gõ end)', huawei: 'save', mikrotik: '(Tự động lưu tức thì)', ruijie: 'write memory (wr)', edgecore: 'copy run start' },
      { task: 'Vào chế độ cấu hình', cisco: 'configure terminal', ciscocbs: 'configure', juniper: 'configure', fortinet: 'config <subsystem>', huawei: 'system-view', mikrotik: '(Gõ trực tiếp ở root)', ruijie: 'configure terminal', edgecore: 'configure' },
      { task: 'Thoát ra ngoài 1 cấp', cisco: 'exit', ciscocbs: 'exit', juniper: 'exit', fortinet: 'next (hoặc end)', huawei: 'quit', mikrotik: '..', ruijie: 'exit', edgecore: 'exit' },
      { task: 'Xem trạng thái Interface', cisco: 'show ip interface brief', ciscocbs: 'show interfaces status', juniper: 'show interfaces terse', fortinet: 'get system interface physical', huawei: 'display ip interface brief', mikrotik: '/interface print', ruijie: 'show ip interface brief', edgecore: 'show interfaces status' },
      { task: 'Xem bảng MAC Address', cisco: 'show mac address-table', ciscocbs: 'show mac address-table', juniper: 'show ethernet-switching table', fortinet: 'diagnose switch mac-address list', huawei: 'display mac-address', mikrotik: '/interface bridge host print', ruijie: 'show mac-address-table', edgecore: 'show mac-address-table' },
      { task: 'Xem bảng định tuyến (Route)', cisco: 'show ip route', ciscocbs: 'show ip route', juniper: 'show route', fortinet: 'get router info routing-table all', huawei: 'display ip routing-table', mikrotik: '/ip route print', ruijie: 'show ip route', edgecore: 'show ip route' },
      { task: 'Xem bảng ARP', cisco: 'show ip arp', ciscocbs: 'show ip arp', juniper: 'show arp', fortinet: 'diagnose ip arp list', huawei: 'display arp', mikrotik: '/ip arp print', ruijie: 'show arp', edgecore: 'show arp' },
      { task: 'Lọc kết quả (Grep / Pipe)', cisco: '| include <từ khóa>', ciscocbs: '| include <từ khóa>', juniper: '| match <từ khóa>', fortinet: '| grep <từ khóa>', huawei: '| include <từ khóa>', mikrotik: 'where <field>=<value>', ruijie: '| include <từ khóa>', edgecore: '| include <từ khóa>' },
      { task: 'Khởi động lại (Reboot)', cisco: 'reload', ciscocbs: 'reload', juniper: 'request system reboot', fortinet: 'execute reboot', huawei: 'reboot', mikrotik: '/system reboot', ruijie: 'reload', edgecore: 'reload' }
    ];

    // Initial Renders
    renderRosetta();
    renderPorts();
    renderRecoveryPlaybook();
    initSubnetCalculator();
    renderCards();
    renderShowCommands();
    renderConsoleSerial();
    renderFiberOptics();
    console.log('✅ NetCLI API data loaded successfully!');
  } catch (err) {
    console.error('API Error, check server status:', err);
    showToast('Lỗi tải dữ liệu từ API Node.js!');
  }
}

// Parameters helper
function getParams() {
  const vlanId = document.getElementById('param-vlan-id')?.value || '10';
  const vlanName = document.getElementById('param-vlan-name')?.value || 'DATA_LAN';
  const accessPort = document.getElementById('param-access-port')?.value || 'ge-0/0/1';
  const trunkPort = document.getElementById('param-trunk-port')?.value || 'ge-0/0/24';
  const ipCidr = document.getElementById('param-ip-cidr')?.value || '192.168.10.1/24';
  const nextHop = document.getElementById('param-nexthop')?.value || '192.168.1.1';
  const user = document.getElementById('param-user')?.value || 'itadmin';
  const pass = document.getElementById('param-pass')?.value || 'NetAdmin@2026!';
  const netmask = document.getElementById('param-mask')?.value || '255.255.255.0';
  const subnet = document.getElementById('param-subnet')?.value || '192.168.10.0';
  const lagId = document.getElementById('param-lag-id')?.value || '1';

  const ipAddr = ipCidr.split('/')[0] || '192.168.10.1';

  return {
    '{{VLAN_ID}}': vlanId,
    '{{VLAN_NAME}}': vlanName,
    '{{ACCESS_PORT}}': accessPort,
    '{{TRUNK_PORT}}': trunkPort,
    '{{IP_CIDR}}': ipCidr,
    '{{IP_ADDR}}': ipAddr,
    '{{NEXTHOP}}': nextHop,
    '{{USER}}': user,
    '{{PASS}}': pass,
    '{{NETMASK}}': netmask,
    '{{SUBNET}}': subnet,
    '{{LAG_ID}}': lagId
  };
}

function replaceParams(cmdStr) {
  const params = getParams();
  let res = cmdStr;
  for (const [k, v] of Object.entries(params)) {
    res = res.split(k).join(v);
  }
  return res;
}

// Toast Notification
function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  toastMsg.textContent = msg || 'Đã sao chép lệnh!';
  toast.classList.remove('translate-y-16', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');
  setTimeout(() => {
    toast.classList.add('translate-y-16', 'opacity-0');
    toast.classList.remove('translate-y-0', 'opacity-100');
  }, 2200);
}

// Copy to clipboard with micro-interaction
function copyText(text, btnElement = null) {
  if (btnElement) {
    const origContent = btnElement.innerHTML;
    btnElement.classList.add('scale-95', 'bg-emerald-600', 'text-white');
    btnElement.innerHTML = `
      <svg class="w-3.5 h-3.5 text-white animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
      <span class="font-bold">Đã Copy!</span>
    `;
    setTimeout(() => {
      btnElement.innerHTML = origContent;
      btnElement.classList.remove('scale-95', 'bg-emerald-600', 'text-white');
    }, 1200);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Đã copy đoạn lệnh vào clipboard!');
    }).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Đã copy đoạn lệnh vào clipboard!');
  } catch (err) {
    showToast('Vui lòng chọn và sao chép thủ công');
  }
}

// Helper escape functions
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;');
}

// Render Generator Cards
function renderCards() {
  const container = document.getElementById('cards-container');
  const emptyState = document.getElementById('empty-state');
  if (!container) return;
  container.innerHTML = '';

  let matchedTasks = 0;
  document.getElementById('count-all').textContent = CORE_TASKS.length + customSnippets.length;
  document.getElementById('count-custom').textContent = customSnippets.length;

  const query = searchQuery.trim().toLowerCase();
  const allDisplayTasks = [...CORE_TASKS];

  customSnippets.forEach(snip => {
    allDisplayTasks.push({
      id: 'custom-' + snip.id,
      title: snip.title,
      category: snip.category || 'custom',
      isCustom: true,
      customVendor: snip.vendor,
      desc: snip.notes || 'Cấu hình tùy biến do người dùng thêm',
      vendors: {
        [snip.vendor.toLowerCase()]: {
          cmds: snip.commands.split('\n'),
          note: snip.notes || 'Lệnh tùy chỉnh'
        }
      }
    });
  });

  allDisplayTasks.forEach(task => {
    if (activeCategory !== 'ALL') {
      if (activeCategory === 'custom' && !task.isCustom) return;
      if (activeCategory !== 'custom' && task.category !== activeCategory) return;
    }

    if (query) {
      const matchTitle = task.title.toLowerCase().includes(query);
      const matchDesc = task.desc.toLowerCase().includes(query);
      let matchCmds = false;
      let matchVendor = false;

      for (const [vKey, vData] of Object.entries(task.vendors)) {
        const vInfo = VENDORS_INFO[vKey] || { name: task.customVendor || vKey };
        if (vInfo.name && vInfo.name.toLowerCase().includes(query)) matchVendor = true;
        if (vData.cmds && vData.cmds.some(c => c.toLowerCase().includes(query))) matchCmds = true;
      }

      if (!matchTitle && !matchDesc && !matchCmds && !matchVendor) return;
    }

    matchedTasks++;

    const card = document.createElement('div');
    card.className = 'bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm card-smooth-fx animate-fade-in-up';

    const categoryBadge = {
      l2: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      l3: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      dynamic: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      services: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      sec: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      vpn: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      mgmt: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      ts: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      custom: 'bg-teal-500/10 text-teal-400 border-teal-500/20'
    }[task.category] || 'bg-slate-800 text-slate-300 border-slate-700';

    const catName = {
      l2: 'L2 Switching & STP',
      l3: 'L3 Routing & FHRP',
      dynamic: 'OSPF & BGP',
      services: 'DHCP & Services',
      sec: 'Security & NAT',
      vpn: 'VPN (IPsec / GRE)',
      mgmt: 'Quản Trị & Save',
      ts: 'Troubleshoot Thực Chiến',
      custom: 'Tùy Biến'
    }[task.category] || 'Mạng';

    let vendorBlocksHtml = '';
    const vendorKeys = Object.keys(task.vendors);

    vendorKeys.forEach(vKey => {
      if (activeVendor !== 'ALL') {
        if (task.isCustom) {
          if (task.customVendor.toLowerCase() !== activeVendor && vKey !== activeVendor) return;
        } else if (vKey !== activeVendor) {
          return;
        }
      }

      const vData = task.vendors[vKey];
      const vInfo = VENDORS_INFO[vKey] || { 
        name: task.customVendor || vKey.toUpperCase(), 
        color: 'border-slate-500/30 text-slate-300 bg-slate-800/40' 
      };

      const rawCmdLines = (vData.cmds || []).map(cmd => replaceParams(cmd));
      const fullCmdText = rawCmdLines.join('\n');

      const formattedCmdLines = rawCmdLines.map(line => {
        if (line.trim().startsWith('#')) {
          return `<span class="text-slate-500 italic">${escapeHtml(line)}</span>`;
        }
        return `<span class="text-emerald-300 font-mono">${escapeHtml(line)}</span>`;
      }).join('\n');

      vendorBlocksHtml += `
        <div class="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between group/cmd hover:border-slate-700 transition">
          <div>
            <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60">
              <span class="text-xs font-semibold px-2 py-0.5 rounded border ${vInfo.color}">
                ${escapeHtml(vInfo.name)}
              </span>
              <button 
                class="btn-copy-vendor px-2 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 transition flex items-center gap-1"
                data-copy="${escapeAttr(fullCmdText)}"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                <span>Copy</span>
              </button>
            </div>
            <pre class="code-font text-xs text-slate-200 overflow-x-auto p-2.5 rounded bg-slate-900 border border-slate-800 select-all leading-relaxed whitespace-pre">${formattedCmdLines}</pre>
          </div>
          ${vData.note ? `
            <div class="mt-2 text-[11px] text-slate-400 flex items-start gap-1.5 pt-1">
              <span class="text-amber-400 font-bold">ℹ</span>
              <span>${escapeHtml(vData.note)}</span>
            </div>
          ` : ''}
        </div>
      `;
    });

    if (!vendorBlocksHtml) return;

    const gridCols = activeVendor === 'ALL' 
      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3' 
      : 'grid grid-cols-1 gap-3';

    card.innerHTML = `
      <div class="px-5 py-3.5 bg-slate-800/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${categoryBadge}">
              ${catName}
            </span>
            <h3 class="text-sm sm:text-base font-bold text-white">${escapeHtml(task.title)}</h3>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">${escapeHtml(task.desc)}</p>
        </div>
        ${task.isCustom ? `
          <button class="btn-delete-custom text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20" data-id="${task.id.replace('custom-', '')}">
            Xóa mục này
          </button>
        ` : ''}
      </div>
      <div class="p-4 ${gridCols}">
        ${vendorBlocksHtml}
      </div>
    `;

    container.appendChild(card);
  });

  if (matchedTasks === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
  }

  document.querySelectorAll('.btn-copy-vendor').forEach(btn => {
    btn.addEventListener('click', () => {
      copyText(btn.getAttribute('data-copy'), btn);
    });
  });

  document.querySelectorAll('.btn-delete-custom').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      customSnippets = customSnippets.filter(s => s.id !== id);
      try {
        localStorage.setItem('netcli_custom_snippets', JSON.stringify(customSnippets));
      } catch (e) {}
      showToast('Đã xóa cấu hình tùy biến!');
      renderCards();
    });
  });
}

// Render Show Commands View
function renderShowCommands() {
  const container = document.getElementById('showcmds-container');
  if (!container) return;
  container.innerHTML = '';

  document.getElementById('showcmd-count-all').textContent = SHOW_COMMANDS_DATA.length;
  const q = showSearchQuery.toLowerCase().trim();

  SHOW_COMMANDS_DATA.forEach(item => {
    if (activeShowCategory !== 'ALL' && item.category !== activeShowCategory) return;

    if (q) {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.desc.toLowerCase().includes(q);
      const matchTip = item.tip ? item.tip.toLowerCase().includes(q) : false;
      let matchCmd = false;
      const vendors = ['cisco', 'ciscocbs', 'juniper', 'fortinet', 'huawei', 'mikrotik', 'ruijie', 'edgecore'];
      vendors.forEach(v => {
        if (item[v] && item[v].toLowerCase().includes(q)) matchCmd = true;
      });
      if (!matchTitle && !matchDesc && !matchTip && !matchCmd) return;
    }

    const card = document.createElement('div');
    card.className = 'bg-slate-950 border border-slate-800 rounded-xl overflow-hidden card-smooth-fx animate-fade-in-up p-4 flex flex-col gap-3';

    const vendorsList = [
      { key: 'cisco', label: 'Cisco Catalyst', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
      { key: 'ciscocbs', label: 'Cisco CBS', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
      { key: 'juniper', label: 'Juniper Junos', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
      { key: 'fortinet', label: 'Fortinet FortiOS', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
      { key: 'huawei', label: 'Huawei VRP', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
      { key: 'mikrotik', label: 'MikroTik RouterOS', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
      { key: 'ruijie', label: 'Ruijie RGOS', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
      { key: 'edgecore', label: 'Edgecore ECS', color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' }
    ];

    let vendorBlocks = vendorsList.map(v => {
      const cmd = item[v.key] || '-';
      return `
        <div class="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 flex flex-col justify-between group/vcmd hover:border-slate-700 transition">
          <div class="flex items-center justify-between pb-1 mb-1 border-b border-slate-800/50">
            <span class="text-[10px] font-bold px-1.5 py-0.2 rounded border ${v.color}">${v.label}</span>
            <button class="btn-copy-sh text-[10px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition" data-copy="${escapeAttr(cmd)}">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              <span>Copy</span>
            </button>
          </div>
          <div class="font-mono text-xs text-slate-200 select-all whitespace-pre-wrap break-all pt-0.5 leading-snug">${escapeHtml(cmd)}</div>
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div>
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="text-sm font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-purple-400"></span>
              ${escapeHtml(item.title)}
            </h4>
            <p class="text-xs text-slate-400 mt-0.5">${escapeHtml(item.desc)}</p>
          </div>
        </div>
        ${item.tip ? `
          <div class="mt-2 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-start gap-1.5">
            <span class="font-bold text-amber-400">💡 Mẹo phân tích Output:</span>
            <span>${escapeHtml(item.tip)}</span>
          </div>
        ` : ''}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
        ${vendorBlocks}
      </div>
    `;

    container.appendChild(card);
  });

  document.querySelectorAll('.btn-copy-sh').forEach(btn => {
    btn.addEventListener('click', () => {
      copyText(btn.getAttribute('data-copy'), btn);
    });
  });
}

// Render Rosetta Table
function renderRosetta() {
  const tbody = document.getElementById('rosetta-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  ROSETTA_DATA.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition';
    tr.innerHTML = `
      <td class="p-3 font-sans font-medium text-slate-300 border-b border-slate-800">${escapeHtml(row.task)}</td>
      <td class="p-3 text-emerald-300 border-b border-slate-800 select-all">${escapeHtml(row.cisco)}</td>
      <td class="p-3 text-sky-300 border-b border-slate-800 select-all">${escapeHtml(row.ciscocbs)}</td>
      <td class="p-3 text-amber-300 border-b border-slate-800 select-all">${escapeHtml(row.juniper)}</td>
      <td class="p-3 text-rose-300 border-b border-slate-800 select-all">${escapeHtml(row.fortinet)}</td>
      <td class="p-3 text-blue-300 border-b border-slate-800 select-all">${escapeHtml(row.huawei)}</td>
      <td class="p-3 text-purple-300 border-b border-slate-800 select-all">${escapeHtml(row.mikrotik)}</td>
      <td class="p-3 text-cyan-300 border-b border-slate-800 select-all">${escapeHtml(row.ruijie)}</td>
      <td class="p-3 text-teal-300 border-b border-slate-800 select-all">${escapeHtml(row.edgecore)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Ports Directory
function renderPorts(query = '') {
  const tbody = document.getElementById('ports-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const q = query.toLowerCase().trim();

  const filtered = NETWORK_PORTS_DATA.filter(p => {
    if (!q) return true;
    return p.port.toLowerCase().includes(q) ||
           p.proto.toLowerCase().includes(q) ||
           p.name.toLowerCase().includes(q) ||
           p.desc.toLowerCase().includes(q);
  });

  filtered.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition';
    tr.innerHTML = `
      <td class="p-3 text-amber-400 font-bold select-all">${escapeHtml(p.port)}</td>
      <td class="p-3 text-cyan-300 font-semibold">${escapeHtml(p.proto)}</td>
      <td class="p-3 text-white font-medium">${escapeHtml(p.name)}</td>
      <td class="p-3 text-slate-300 font-sans text-xs">${escapeHtml(p.desc)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Recovery Playbooks
function renderRecoveryPlaybook() {
  const container = document.getElementById('recovery-cards-container');
  if (!container) return;
  container.innerHTML = '';
  RECOVERY_PLAYBOOK_DATA.forEach(item => {
    const card = document.createElement('div');
    card.className = 'bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between card-smooth-fx animate-fade-in-up';

    let stepsHtml = item.steps.map(s => {
      return `<li class="text-xs text-slate-300 leading-relaxed">${escapeHtml(s)}</li>`;
    }).join('');

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
          <span class="text-xs font-bold px-2.5 py-1 rounded border ${item.icon}">
            ${escapeHtml(item.vendor)}
          </span>
          <button class="btn-copy-recovery text-[11px] text-slate-400 hover:text-emerald-400 font-medium flex items-center gap-1" data-copy="${escapeAttr(item.steps.join('\n'))}">
            Copy các bước
          </button>
        </div>
        <ol class="space-y-2 list-none">
          ${stepsHtml}
        </ol>
      </div>
    `;
    container.appendChild(card);
  });

  document.querySelectorAll('.btn-copy-recovery').forEach(btn => {
    btn.addEventListener('click', () => {
      copyText(btn.getAttribute('data-copy'), btn);
    });
  });
}

// Subnet Calculator
function initSubnetCalculator() {
  const select = document.getElementById('calc-prefix-select');
  if (!select) return;
  select.innerHTML = '';
  for (let i = 32; i >= 8; i--) {
    const opt = document.createElement('option');
    opt.value = i;
    const mask = prefixToMask(i);
    const hosts = i >= 31 ? (i === 31 ? 2 : 1) : Math.pow(2, 32 - i) - 2;
    opt.textContent = `/${i} (${mask}) - ${hosts.toLocaleString()} hosts`;
    if (i === 24) opt.selected = true;
    select.appendChild(opt);
  }

  select.addEventListener('change', (e) => {
    const currentIp = document.getElementById('calc-ip-input').value.split('/')[0] || '192.168.10.1';
    document.getElementById('calc-ip-input').value = `${currentIp}/${e.target.value}`;
    calculateSubnet();
  });

  document.getElementById('calc-btn-run').addEventListener('click', calculateSubnet);
  document.getElementById('calc-ip-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') calculateSubnet();
  });

  calculateSubnet();
}

function prefixToMask(prefix) {
  let mask = [];
  for (let i = 0; i < 4; i++) {
    let n = Math.min(prefix, 8);
    mask.push(256 - Math.pow(2, 8 - n));
    prefix -= n;
  }
  return mask.join('.');
}

function ipToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function intToIp(int) {
  return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
}

function calculateSubnet() {
  const raw = document.getElementById('calc-ip-input').value.trim();
  const parts = raw.split('/');
  let ipStr = parts[0].trim();
  let prefix = parseInt(parts[1], 10);

  const ipParts = ipStr.split('.');
  if (ipParts.length !== 4 || ipParts.some(p => isNaN(p) || parseInt(p) < 0 || parseInt(p) > 255)) {
    showToast('Địa chỉ IP không hợp lệ! Vui lòng kiểm tra lại.');
    return;
  }

  if (isNaN(prefix) || prefix < 0 || prefix > 32) prefix = 24;

  const ipInt = ipToInt(ipStr);
  const maskInt = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const wildcardInt = (~maskInt) >>> 0;
  const netInt = (ipInt & maskInt) >>> 0;
  const bcastInt = (netInt | wildcardInt) >>> 0;

  const maskStr = intToIp(maskInt);
  const wildcardStr = intToIp(wildcardInt);
  const netStr = intToIp(netInt);
  const bcastStr = intToIp(bcastInt);

  let firstHostStr, lastHostStr, totalHosts;
  if (prefix === 32) {
    firstHostStr = netStr;
    lastHostStr = netStr;
    totalHosts = 1;
  } else if (prefix === 31) {
    firstHostStr = netStr;
    lastHostStr = bcastStr;
    totalHosts = 2;
  } else {
    firstHostStr = intToIp(netInt + 1);
    lastHostStr = intToIp(bcastInt - 1);
    totalHosts = Math.pow(2, 32 - prefix) - 2;
  }

  document.getElementById('calc-prefix-select').value = prefix;

  const container = document.getElementById('calc-results');
  container.innerHTML = `
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between card-smooth-fx animate-fade-in-up">
      <div class="text-xs text-slate-400 font-medium">Địa chỉ Mạng (Network ID)</div>
      <div class="text-base font-mono font-bold text-cyan-400 select-all mt-1">${netStr} /${prefix}</div>
      <div class="text-[11px] text-slate-500 mt-2">Dùng để khai báo Route &amp; OSPF network</div>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between card-smooth-fx animate-fade-in-up">
      <div class="text-xs text-slate-400 font-medium">Subnet Mask Chuẩn</div>
      <div class="text-base font-mono font-bold text-emerald-400 select-all mt-1">${maskStr}</div>
      <div class="text-[11px] text-slate-500 mt-2">Dùng cho Interface IP &amp; Static Route</div>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between card-smooth-fx animate-fade-in-up">
      <div class="text-xs text-slate-400 font-medium">Cisco/Huawei Wildcard Mask</div>
      <div class="text-base font-mono font-bold text-amber-400 select-all mt-1">${wildcardStr}</div>
      <div class="text-[11px] text-slate-500 mt-2">Bắt buộc khi cấu hình OSPF &amp; ACL</div>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between card-smooth-fx animate-fade-in-up">
      <div class="text-xs text-slate-400 font-medium">Địa chỉ Broadcast</div>
      <div class="text-base font-mono font-bold text-rose-400 select-all mt-1">${bcastStr}</div>
      <div class="text-[11px] text-slate-500 mt-2">Địa chỉ quảng bá toàn mạng</div>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:col-span-2 flex flex-col justify-between card-smooth-fx animate-fade-in-up">
      <div class="text-xs text-slate-400 font-medium">Dải IP Khả Dụng Cho Thiết Bị (Usable Host Range)</div>
      <div class="text-sm sm:text-base font-mono font-bold text-white select-all mt-1">${firstHostStr} &mdash; ${lastHostStr}</div>
      <div class="text-[11px] text-slate-500 mt-2">Dải IP hợp lệ để cấp cho PC, Server, Camera, AP</div>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between card-smooth-fx animate-fade-in-up">
      <div class="text-xs text-slate-400 font-medium">Số Lượng Máy Khả Dụng (Usable Hosts)</div>
      <div class="text-base font-mono font-bold text-purple-400 mt-1">${totalHosts.toLocaleString()} Hosts</div>
      <div class="text-[11px] text-slate-500 mt-2">Tổng số máy con tối đa cắm vào subnet</div>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between card-smooth-fx animate-fade-in-up">
      <div class="text-xs text-slate-400 font-medium">Phân Loại Lớp Mạng (Class)</div>
      <div class="text-base font-mono font-bold text-sky-400 mt-1">${getIpClass(ipStr)}</div>
      <div class="text-[11px] text-slate-500 mt-2">${isPrivateIp(ipStr) ? 'Địa chỉ Private (Nội bộ RFC 1918)' : 'Địa chỉ Public (Internet)'}</div>
    </div>
  `;
}

function getIpClass(ip) {
  const first = parseInt(ip.split('.')[0], 10);
  if (first >= 1 && first <= 126) return 'Class A (Mặc định /8)';
  if (first === 127) return 'Loopback (127.0.0.0/8)';
  if (first >= 128 && first <= 191) return 'Class B (Mặc định /16)';
  if (first >= 192 && first <= 223) return 'Class C (Mặc định /24)';
  if (first >= 224 && first <= 239) return 'Class D (Multicast)';
  return 'Class E (Dự phòng)';
}

function isPrivateIp(ip) {
  const [o1, o2] = ip.split('.').map(n => parseInt(n, 10));
  if (o1 === 10) return true;
  if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
  if (o1 === 192 && o2 === 168) return true;
  return false;
}

// Document Ready Setup
document.addEventListener('DOMContentLoaded', () => {
  fetchAllData();

  // Top Nav Switcher with Smooth Animation
  document.querySelectorAll('.nav-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetViewId = btn.getAttribute('data-view');
      
      // Update active states
      document.querySelectorAll('.nav-view-btn').forEach(b => {
        b.classList.remove('bg-emerald-600', 'text-white', 'font-bold');
        if (b.classList.contains('rounded-full')) {
          b.classList.add('bg-slate-900', 'text-slate-300');
        } else if (!b.closest('#dropdown-tools-menu')) {
          b.classList.add('text-slate-400');
        }
      });

      btn.classList.add('bg-emerald-600', 'text-white', 'font-bold');
      btn.classList.remove('text-slate-400', 'bg-slate-900');

      // Update Dropdown label if clicked from inside dropdown
      const subLabel = btn.querySelector('.font-semibold')?.textContent;
      if (subLabel && labelActiveTool) {
        labelActiveTool.textContent = subLabel;
        btnDropdown.classList.add('text-amber-300', 'bg-slate-900');
      } else if (labelActiveTool && ['view-generator', 'view-showcmds', 'view-subnet'].includes(targetViewId)) {
        labelActiveTool.textContent = 'Sổ Tay Kỹ Sư';
        btnDropdown.classList.remove('text-amber-300', 'bg-slate-900');
      }

      // Close dropdown if open
      if (menuDropdown) {
        menuDropdown.classList.add('hidden');
        if (arrowDropdown) arrowDropdown.classList.remove('rotate-180');
      }

      document.querySelectorAll('.view-panel').forEach(panel => panel.classList.add('hidden'));
      const targetPanel = document.getElementById(targetViewId);
      if (targetPanel) {
        targetPanel.classList.remove('hidden');
        targetPanel.classList.remove('animate-fade-in-up');
        void targetPanel.offsetWidth;
        targetPanel.classList.add('animate-fade-in-up');
      }
    });
  });


  // Dropdown Tools Toggle
  const btnDropdown = document.getElementById('btn-dropdown-tools');
  const menuDropdown = document.getElementById('dropdown-tools-menu');
  const arrowDropdown = document.getElementById('icon-dropdown-arrow');
  const labelActiveTool = document.getElementById('label-active-tool');

  if (btnDropdown && menuDropdown) {
    btnDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = menuDropdown.classList.contains('hidden');
      if (isHidden) {
        menuDropdown.classList.remove('hidden');
        if (arrowDropdown) arrowDropdown.classList.add('rotate-180');
      } else {
        menuDropdown.classList.add('hidden');
        if (arrowDropdown) arrowDropdown.classList.remove('rotate-180');
      }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!menuDropdown.contains(e.target) && !btnDropdown.contains(e.target)) {
        menuDropdown.classList.add('hidden');
        if (arrowDropdown) arrowDropdown.classList.remove('rotate-180');
      }
    });
  }

  // Search input handler
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderCards();
  });

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      document.getElementById('nav-btn-generator').click();
      searchInput.focus();
    }
  });

  // Vendor Filter
  const vendorFilter = document.getElementById('vendor-filter');
  vendorFilter.addEventListener('change', (e) => {
    activeVendor = e.target.value;
    renderCards();
  });

  // Category Tabs
  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(t => {
        t.classList.remove('border-emerald-500', 'text-emerald-400', 'bg-slate-900/60', 'font-semibold');
        t.classList.add('border-transparent', 'text-slate-400');
      });
      tab.classList.remove('border-transparent', 'text-slate-400');
      tab.classList.add('border-emerald-500', 'text-emerald-400', 'bg-slate-900/60', 'font-semibold');
      activeCategory = tab.getAttribute('data-cat');
      renderCards();
    });
  });

  // Dynamic parameters change
  const paramInputs = [
    'param-vlan-id', 'param-vlan-name', 'param-access-port', 'param-trunk-port',
    'param-ip-cidr', 'param-nexthop', 'param-user', 'param-pass', 'param-mask',
    'param-subnet', 'param-lag-id'
  ];
  paramInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => renderCards());
  });

  // Reset params button
  const btnResetParams = document.getElementById('btn-reset-params');
  btnResetParams.addEventListener('click', () => {
    document.getElementById('param-vlan-id').value = '10';
    document.getElementById('param-vlan-name').value = 'DATA_LAN';
    document.getElementById('param-access-port').value = 'ge-0/0/1';
    document.getElementById('param-trunk-port').value = 'ge-0/0/24';
    document.getElementById('param-ip-cidr').value = '192.168.10.1/24';
    document.getElementById('param-nexthop').value = '192.168.1.1';
    document.getElementById('param-user').value = 'itadmin';
    document.getElementById('param-pass').value = 'NetAdmin@2026!';
    document.getElementById('param-mask').value = '255.255.255.0';
    document.getElementById('param-subnet').value = '192.168.10.0';
    document.getElementById('param-lag-id').value = '1';
    renderCards();
    showToast('Đã khôi phục thông số mặc định');
  });

  // Port search input
  const portSearchInput = document.getElementById('port-search-input');
  portSearchInput.addEventListener('input', (e) => {
    renderPorts(e.target.value);
  });

  // Show Command search handler
  const showSearchInput = document.getElementById('showcmd-search-input');
  if (showSearchInput) {
    showSearchInput.addEventListener('input', (e) => {
      showSearchQuery = e.target.value;
      renderShowCommands();
    });
  }

  // Show Command category filter buttons
  document.querySelectorAll('.showcmd-cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.showcmd-cat-tab').forEach(t => {
        t.classList.remove('bg-purple-600', 'text-white', 'font-semibold');
        t.classList.add('text-slate-400');
      });
      tab.classList.remove('text-slate-400');
      tab.classList.add('bg-purple-600', 'text-white', 'font-semibold');
      activeShowCategory = tab.getAttribute('data-showcat');
      renderShowCommands();
    });
  });

  // Rosetta Modal
  const modalRosetta = document.getElementById('modal-rosetta');
  const btnRosetta = document.getElementById('btn-rosetta');
  const btnCloseRosetta = document.getElementById('btn-close-rosetta');
  const btnCloseRosettaBtm = document.getElementById('btn-close-rosetta-bottom');

  btnRosetta.addEventListener('click', () => modalRosetta.classList.remove('hidden'));
  btnCloseRosetta.addEventListener('click', () => modalRosetta.classList.add('hidden'));
  btnCloseRosettaBtm.addEventListener('click', () => modalRosetta.classList.add('hidden'));

  // Custom Snippet Modal
  const modalCustom = document.getElementById('modal-custom');
  const btnCustomAdd = document.getElementById('btn-custom-add');
  const btnCloseCustom = document.getElementById('btn-close-custom');
  const btnCancelCustom = document.getElementById('btn-cancel-custom');
  const btnSaveCustom = document.getElementById('btn-save-custom');
  const btnExport = document.getElementById('btn-export-backup');

  btnCustomAdd.addEventListener('click', () => {
    document.getElementById('custom-title').value = '';
    document.getElementById('custom-vendor').value = '';
    document.getElementById('custom-commands').value = '';
    document.getElementById('custom-notes').value = '';
    modalCustom.classList.remove('hidden');
  });

  btnCloseCustom.addEventListener('click', () => modalCustom.classList.add('hidden'));
  btnCancelCustom.addEventListener('click', () => modalCustom.classList.add('hidden'));

  btnSaveCustom.addEventListener('click', () => {
    const title = document.getElementById('custom-title').value.trim();
    const vendor = document.getElementById('custom-vendor').value.trim();
    const category = document.getElementById('custom-category').value;
    const commands = document.getElementById('custom-commands').value.trim();
    const notes = document.getElementById('custom-notes').value.trim();

    if (!title || !vendor || !commands) {
      showToast('Vui lòng điền đủ Tên tác vụ, Hãng và Đoạn lệnh!');
      return;
    }

    const newSnip = {
      id: Date.now().toString(),
      title,
      vendor,
      category,
      commands,
      notes
    };

    customSnippets.push(newSnip);
    try {
      localStorage.setItem('netcli_custom_snippets', JSON.stringify(customSnippets));
    } catch (e) {}

    modalCustom.classList.add('hidden');
    showToast('Đã thêm thành công vào cẩm nang!');
    renderCards();
  });

  // Export Backup JSON
  btnExport.addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(customSnippets, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'netcli_custom_backup.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Đã tải xuống file backup JSON!');
  });


  // Admin Login Handler
  document.getElementById('admin-btn-login')?.addEventListener('click', loginAdmin);
  document.getElementById('admin-pin-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginAdmin();
  });

  document.getElementById('admin-btn-logout')?.addEventListener('click', () => {
    sessionStorage.removeItem('netcli_admin_token');
    isAdminAuthenticated = false;
    showToast('Đã đăng xuất khỏi Admin Portal');
    document.getElementById('admin-login-box')?.classList.remove('hidden');
    document.getElementById('admin-panel')?.classList.add('hidden');
  });

  // Admin Subtabs (tasks / vendors)
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => {
        t.classList.remove('border-purple-500', 'text-purple-400', 'bg-slate-950/60');
        t.classList.add('border-transparent', 'text-slate-400');
      });
      tab.classList.remove('border-transparent', 'text-slate-400');
      tab.classList.add('border-purple-500', 'text-purple-400', 'bg-slate-950/60');

      const target = tab.getAttribute('data-admintab');
      if (target === 'tasks') {
        document.getElementById('admintab-view-tasks')?.classList.remove('hidden');
        document.getElementById('admintab-view-vendors')?.classList.add('hidden');
      } else {
        document.getElementById('admintab-view-tasks')?.classList.add('hidden');
        document.getElementById('admintab-view-vendors')?.classList.remove('hidden');
      }
    });
  });

  // Admin Add Vendor
  document.getElementById('admin-btn-save-vendor')?.addEventListener('click', async () => {
    const key = document.getElementById('admin-vendor-key')?.value.trim();
    const name = document.getElementById('admin-vendor-name')?.value.trim();
    if (!key || !name) {
      showToast('Vui lòng nhập đủ Key và Tên hãng!');
      return;
    }

    try {
      const res = await fetch('/api/admin/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, name })
      });
      const data = await res.json();
      showToast(data.message || 'Đã thêm hãng mới!');
      document.getElementById('admin-vendor-key').value = '';
      document.getElementById('admin-vendor-name').value = '';
      // Update local state
      VENDORS_INFO[key.toLowerCase()] = { name, color: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10' };
      renderCards();
    } catch (e) {
      showToast('Lỗi gửi API!');
    }
  });

  // Open modal custom when clicking add task in admin
  document.getElementById('btn-admin-open-add-task')?.addEventListener('click', () => {
    document.getElementById('btn-custom-add')?.click();
  });

  // Check auth state if navigating to admin view
  document.querySelector('[data-view="view-admin"]')?.addEventListener('click', () => {
    checkAdminAuth();
  });

});


// Render Console Serial Table
function renderConsoleSerial() {
  const tbody = document.getElementById('console-tbody');
  if (!tbody || !CONSOLE_SERIAL_DATA.length) return;
  tbody.innerHTML = '';
  CONSOLE_SERIAL_DATA.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition';
    tr.innerHTML = `
      <td class="p-3 text-white font-bold">${escapeHtml(row.vendor)}</td>
      <td class="p-3 text-amber-400 font-bold select-all">${escapeHtml(row.baud)}</td>
      <td class="p-3 text-slate-300">${escapeHtml(row.settings)}</td>
      <td class="p-3 text-slate-300 font-sans">${escapeHtml(row.cable)}</td>
      <td class="p-3 text-cyan-300 select-all">${escapeHtml(row.defaultUser)}</td>
      <td class="p-3 text-amber-300/90 font-sans text-xs">${escapeHtml(row.note)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Fiber Optics & SFP Unlock Playbook
function renderFiberOptics() {
  const tbody = document.getElementById('fiber-standards-tbody');
  const cardsContainer = document.getElementById('sfp-unlock-cards');
  if (!tbody || !FIBER_OPTICS_DATA.standards) return;

  tbody.innerHTML = '';
  FIBER_OPTICS_DATA.standards.forEach(std => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition';
    tr.innerHTML = `
      <td class="p-3 text-white font-bold">${escapeHtml(std.type)}</td>
      <td class="p-3 text-cyan-400 font-bold">${escapeHtml(std.wavelength)}</td>
      <td class="p-3 text-slate-300">${escapeHtml(std.core)}</td>
      <td class="p-3 text-amber-300">${escapeHtml(std.jacket)}</td>
      <td class="p-3 text-emerald-400 font-bold">${escapeHtml(std.maxDistance)}</td>
      <td class="p-3 text-slate-300 font-sans">${escapeHtml(std.desc)}</td>
    `;
    tbody.appendChild(tr);
  });

  if (cardsContainer && FIBER_OPTICS_DATA.sfpUnlockTricks) {
    cardsContainer.innerHTML = '';
    FIBER_OPTICS_DATA.sfpUnlockTricks.forEach(item => {
      const card = document.createElement('div');
      card.className = 'bg-slate-950 border border-slate-800 rounded-xl p-3.5 card-smooth-fx flex flex-col justify-between';
      const cmdText = item.cmds.join('\n');
      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800">
            <span class="text-xs font-bold text-emerald-400">${escapeHtml(item.vendor)}</span>
            <button class="btn-copy-fiber text-[10px] text-slate-400 hover:text-emerald-400 font-medium flex items-center gap-1" data-copy="${escapeAttr(cmdText)}">
              Copy lệnh
            </button>
          </div>
          <pre class="code-font text-xs text-emerald-300 bg-slate-900 p-2 rounded border border-slate-800 leading-relaxed overflow-x-auto whitespace-pre">${escapeHtml(cmdText)}</pre>
        </div>
        <div class="text-[11px] text-slate-400 mt-2 font-sans">${escapeHtml(item.note)}</div>
      `;
      cardsContainer.appendChild(card);
    });

    document.querySelectorAll('.btn-copy-fiber').forEach(btn => {
      btn.addEventListener('click', () => copyText(btn.getAttribute('data-copy'), btn));
    });
  }
}


// ==========================================
// ADMIN PORTAL CLIENT LOGIC
// ==========================================
let isAdminAuthenticated = false;

function checkAdminAuth() {
  const token = sessionStorage.getItem('netcli_admin_token');
  if (token) {
    isAdminAuthenticated = true;
    showAdminDashboard();
  } else {
    document.getElementById('admin-login-box')?.classList.remove('hidden');
    document.getElementById('admin-panel')?.classList.add('hidden');
  }
}

async function loginAdmin() {
  const pin = document.getElementById('admin-pin-input')?.value.trim();
  if (!pin) {
    showToast('Vui lòng nhập mã PIN!');
    return;
  }

  try {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    if (data.success) {
      sessionStorage.setItem('netcli_admin_token', data.token);
      isAdminAuthenticated = true;
      showToast('Đăng nhập Quản Trị thành công!');
      showAdminDashboard();
    } else {
      showToast(data.error || 'Mã PIN sai!');
    }
  } catch (err) {
    // If running in client-only demo mode (without backend API):
    if (pin === 'netadmin2026' || pin === 'admin123') {
      sessionStorage.setItem('netcli_admin_token', 'demo_token');
      isAdminAuthenticated = true;
      showToast('Đăng nhập thành công!');
      showAdminDashboard();
    } else {
      showToast('Lỗi kết nối máy chủ!');
    }
  }
}

function showAdminDashboard() {
  document.getElementById('admin-login-box')?.classList.add('hidden');
  document.getElementById('admin-panel')?.classList.remove('hidden');
  loadAdminStats();
  renderAdminTasks();
}

async function loadAdminStats() {
  const grid = document.getElementById('admin-stats-grid');
  if (!grid) return;

  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();

    const hours = Math.floor(data.uptime / 3600);
    const mins = Math.floor((data.uptime % 3600) / 60);

    grid.innerHTML = `
      <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 card-smooth-fx">
        <div class="text-[11px] text-slate-400 font-medium">Trạng Thái Dịch Vụ</div>
        <div class="text-sm font-bold text-emerald-400 flex items-center gap-1.5 mt-1">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Online / Active</span>
        </div>
        <div class="text-[10px] text-slate-500 mt-1">Node ${data.nodeVersion}</div>
      </div>

      <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 card-smooth-fx">
        <div class="text-[11px] text-slate-400 font-medium">RAM Chiếm Dụng</div>
        <div class="text-base font-bold text-cyan-400 mt-1">${data.ramUsedMB} MB</div>
        <div class="text-[10px] text-slate-500 mt-1">Heap: ${data.ramHeapMB} MB</div>
      </div>

      <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 card-smooth-fx">
        <div class="text-[11px] text-slate-400 font-medium">Thời Gian Uptime</div>
        <div class="text-base font-bold text-purple-400 mt-1">${hours}h ${mins}m</div>
        <div class="text-[10px] text-slate-500 mt-1">PM2 Service</div>
      </div>

      <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 card-smooth-fx">
        <div class="text-[11px] text-slate-400 font-medium">Tổng Bài Cấu Hình</div>
        <div class="text-base font-bold text-white mt-1">${data.totalTasks}</div>
        <div class="text-[10px] text-slate-500 mt-1">L2, L3, OSPF, BGP, NAT</div>
      </div>

      <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 card-smooth-fx">
        <div class="text-[11px] text-slate-400 font-medium">Bách Khoa Lệnh Show</div>
        <div class="text-base font-bold text-amber-400 mt-1">${data.totalShowCmds}</div>
        <div class="text-[10px] text-slate-500 mt-1">Tra cứu chẩn đoán</div>
      </div>

      <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 card-smooth-fx">
        <div class="text-[11px] text-slate-400 font-medium">Số Hãng Hỗ Trợ</div>
        <div class="text-base font-bold text-emerald-400 mt-1">${data.totalVendors} Hãng</div>
        <div class="text-[10px] text-slate-500 mt-1">Cisco, Juniper, Forti...</div>
      </div>
    `;
  } catch (err) {
    grid.innerHTML = `
      <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 col-span-full text-xs text-slate-400">
        Đang chạy ở chế độ Client Preview (hoặc backend API đang nạp).
      </div>
    `;
  }
}

function renderAdminTasks() {
  const tbody = document.getElementById('admin-tasks-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  CORE_TASKS.forEach(t => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition';
    tr.innerHTML = `
      <td class="p-3 text-cyan-400 font-bold select-all">${escapeHtml(t.id)}</td>
      <td class="p-3 text-white font-medium">${escapeHtml(t.title)}</td>
      <td class="p-3 text-slate-300 uppercase">${escapeHtml(t.category)}</td>
      <td class="p-3 text-emerald-400 font-bold">${Object.keys(t.vendors || {}).length} Hãng</td>
      <td class="p-3 text-right">
        <button class="btn-admin-del-task px-2.5 py-1 text-[11px] font-medium rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition" data-id="${escapeAttr(t.id)}">
          Xóa
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.btn-admin-del-task').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (confirm(`Bạn có chắc chắn muốn xóa bài cấu hình "${id}" khỏi hệ thống không?`)) {
        try {
          const res = await fetch(`/api/admin/tasks/${id}`, { method: 'DELETE' });
          const resData = await res.json();
          showToast(resData.message || 'Đã xóa!');
          // Refresh tasks
          CORE_TASKS = CORE_TASKS.filter(t => t.id !== id);
          renderAdminTasks();
          renderCards();
        } catch (e) {
          CORE_TASKS = CORE_TASKS.filter(t => t.id !== id);
          renderAdminTasks();
          renderCards();
          showToast('Đã xóa khỏi bộ nhớ!');
        }
      }
    });
  });
}
