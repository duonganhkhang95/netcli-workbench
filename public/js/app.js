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

// Safe JSON fetcher with HTTP status check
async function safeFetchJson(url, fallbackValue) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.warn(`API ${url} returned HTTP ${res.status}`);
      return { ok: false, data: fallbackValue, status: res.status, url };
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.warn(`API ${url} did not return JSON (${contentType})`);
      return { ok: false, data: fallbackValue, status: res.status, url };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    console.error(`Fetch error for ${url}:`, e);
    return { ok: false, data: fallbackValue, error: e.message, url };
  }
}

// Fetch all datasets from Node.js Express REST API in parallel
async function fetchAllData() {
  try {
    const [vendorsR, tasksR, showR, portsR, recoveryR, consoleR, fiberR] = await Promise.all([
      safeFetchJson('/api/vendors', {}),
      safeFetchJson('/api/tasks', []),
      safeFetchJson('/api/show-commands', []),
      safeFetchJson('/api/ports', []),
      safeFetchJson('/api/recovery', []),
      safeFetchJson('/api/console-serial', []),
      safeFetchJson('/api/fiber-optics', {})
    ]);

    VENDORS_INFO = vendorsR.data;
    CORE_TASKS = tasksR.data;
    SHOW_COMMANDS_DATA = showR.data;
    NETWORK_PORTS_DATA = portsR.data;
    RECOVERY_PLAYBOOK_DATA = recoveryR.data;
    CONSOLE_SERIAL_DATA = consoleR.data;
    FIBER_OPTICS_DATA = fiberR.data;

    const failedApis = [vendorsR, tasksR, showR, portsR, recoveryR, consoleR, fiberR].filter(r => !r.ok);
    if (failedApis.length > 0) {
      console.warn('Một số API chưa phản hồi (có thể cần chạy: pm2 restart netcli):', failedApis.map(f => f.url));
      if (failedApis.length >= 5) {
        showToast('Không kết nối được API Node.js! Hãy kiểm tra pm2 status.');
      }
    }

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

    // Initial Renders (each wrapped safely)
    const initSteps = [
      ['renderRosetta', renderRosetta],
      ['renderPorts', renderPorts],
      ['renderRecoveryPlaybook', renderRecoveryPlaybook],
      ['initSubnetCalculator', initSubnetCalculator],
      ['renderCards', renderCards],
      ['renderShowCommands', renderShowCommands],
      ['renderConsoleSerial', renderConsoleSerial],
      ['initQuickBuilder', initQuickBuilder],
      ['initDiagnosticAssistant', initDiagnosticAssistant],
      ['initMikroTikSuite', initMikroTikSuite],
      ['renderFiberOptics', renderFiberOptics],
      ['initThemeAndUpdate', initThemeAndUpdate],
      ['initRaycastPalette', initRaycastPalette]
    ];
    for (const [name, fn] of initSteps) {
      try {
        if (typeof fn === 'function') fn();
      } catch (uiErr) {
        console.error(`UI render error in ${name}:`, uiErr);
      }
    }
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

function getStackSettings() {
  const isStack = document.getElementById('param-stack-mode')?.value === 'stack';
  const unit = Math.max(1, parseInt(document.getElementById('param-stack-unit')?.value, 10) || 1);
  return { isStack, unit };
}

function getVendorSinglePort(vKey, portNum, isStack, unit) {
  const u = isStack ? unit : 0;
  switch (vKey) {
    case 'cisco':
      return isStack ? `GigabitEthernet${unit}/0/${portNum}` : `GigabitEthernet0/${portNum}`;
    case 'ciscocbs':
      return isStack ? `gi${unit}/0/${portNum}` : `gi1/0/${portNum}`;
    case 'juniper':
      return isStack ? `ge-${unit - 1}/0/${portNum}` : `ge-0/0/${portNum}`;
    case 'huawei':
      return isStack ? `GigabitEthernet${unit}/0/${portNum}` : `GigabitEthernet0/0/${portNum}`;
    case 'aruba':
      return isStack ? `${unit}/1/${portNum}` : `1/1/${portNum}`;
    case 'ruijie':
      return isStack ? `GigabitEthernet ${unit}/0/${portNum}` : `GigabitEthernet 0/${portNum}`;
    case 'edgecore':
      return isStack ? `Ethernet ${unit}/${portNum}` : `Ethernet 1/${portNum}`;
    case 'mikrotik':
      return portNum === 24 ? 'sfp-sfpplus1' : `ether${portNum}`;
    case 'fortinet':
      return `port${portNum === 24 ? 2 : portNum}`;
    case 'draytek':
      return `P${portNum === 24 ? 2 : portNum}`;
    default:
      return isStack ? `gi${unit}/0/${portNum}` : `GigabitEthernet0/${portNum}`;
  }
}

function buildVendorPortRange(vKey, startPort, endPort) {
  const s = Math.max(1, parseInt(startPort, 10) || 1);
  const e = Math.max(s, parseInt(endPort, 10) || s);
  const { isStack, unit } = getStackSettings();
  switch (vKey) {
    case 'cisco':
      return isStack ? `range GigabitEthernet${unit}/0/${s} - ${e}` : `range GigabitEthernet0/${s} - ${e}`;
    case 'ciscocbs':
      return isStack ? `range gi${unit}/0/${s}-${e}` : `range gi1/0/${s}-${e}`;
    case 'aruba':
      return isStack ? `${unit}/1/${s}-${unit}/1/${e}` : `1/1/${s}-1/1/${e}`;
    case 'ruijie':
      return isStack ? `range GigabitEthernet ${unit}/0/${s}-${e}` : `range GigabitEthernet 0/${s}-${e}`;
    case 'edgecore':
      return isStack ? `ethernet ${unit}/${s}-${e}` : `ethernet 1/${s}-${e}`;
    case 'huawei':
      return isStack
        ? `GigabitEthernet${unit}/0/${s} to GigabitEthernet${unit}/0/${e}`
        : `GigabitEthernet0/0/${s} to GigabitEthernet0/0/${e}`;
    case 'juniper':
      return isStack ? `ge-${unit - 1}/0/${s}..ge-${unit - 1}/0/${e}` : `ge-0/0/${s}..ge-0/0/${e}`;
    case 'mikrotik':
      return `ether${s}..ether${e}`;
    case 'fortinet':
      return `port${s}-port${e}`;
    case 'draytek':
      return `P${s}-P${e}`;
    default:
      return `${s}-${e}`;
  }
}

function replaceParams(cmdStr, vKey = '') {
  const params = getParams();
  const { isStack, unit } = getStackSettings();
  const rangeEnabled = document.getElementById('param-range-enable')?.checked;

  // If Stack Mode is explicitly enabled and a vendor key is known, adapt single ports to that vendor's stack unit syntax
  if (isStack && vKey && !rangeEnabled) {
    const apVal = document.getElementById('param-access-port')?.value || '';
    const tpVal = document.getElementById('param-trunk-port')?.value || '';
    const apNum = (apVal.match(/(\d+)$/) || [null, '1'])[1];
    const tpNum = (tpVal.match(/(\d+)$/) || [null, '24'])[1];
    params['{{ACCESS_PORT}}'] = getVendorSinglePort(vKey, parseInt(apNum, 10), true, unit);
    params['{{TRUNK_PORT}}'] = getVendorSinglePort(vKey, parseInt(tpNum, 10), true, unit);
  } else if (rangeEnabled) {
    const rStart = document.getElementById('param-range-start')?.value || '1';
    const rEnd = document.getElementById('param-range-end')?.value || '24';
    params['{{ACCESS_PORT}}'] = buildVendorPortRange(vKey, rStart, rEnd);
    if (isStack && vKey) {
      const tpVal = document.getElementById('param-trunk-port')?.value || '';
      const tpNum = (tpVal.match(/(\d+)$/) || [null, '24'])[1];
      params['{{TRUNK_PORT}}'] = getVendorSinglePort(vKey, parseInt(tpNum, 10), true, unit);
    }
  }

  let res = cmdStr;
  // Special Huawei port-group syntax when range mode is active on "interface {{ACCESS_PORT}}"
  if (rangeEnabled && vKey === 'huawei' && res.trim().startsWith('interface {{ACCESS_PORT}}')) {
    const rStart = document.getElementById('param-range-start')?.value || '1';
    const rEnd = document.getElementById('param-range-end')?.value || '24';
    const prefix = isStack ? `GigabitEthernet${unit}/0` : 'GigabitEthernet0/0';
    res = res.replace('interface {{ACCESS_PORT}}', `port-group group-member ${prefix}/${rStart} to ${prefix}/${rEnd}`);
  }
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

      const rawCmdLines = (vData.cmds || []).map(cmd => replaceParams(cmd, vKey));
      const fullCmdText = rawCmdLines.join('\n');

      const formattedCmdLines = rawCmdLines.map(line => {
        if (line.trim().startsWith('#')) {
          return `<span class="text-slate-500 italic">${escapeHtml(line)}</span>`;
        }
        return `<span class="text-emerald-300 font-mono">${escapeHtml(line)}</span>`;
      }).join('\n');

      vendorBlocksHtml += `
        <div class="vendor-cmd-block bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between group/cmd hover:border-slate-700 transition">
          <div>
            <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60 gap-2">
              <span class="text-xs font-semibold px-2 py-0.5 rounded border ${vInfo.color} truncate">
                ${escapeHtml(vInfo.name)}
              </span>
              <div class="flex items-center gap-1.5 shrink-0">
                <button 
                  type="button"
                  class="btn-edit-vendor px-2 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-amber-600 hover:text-white text-slate-300 transition flex items-center gap-1"
                  title="Chỉnh sửa trực tiếp câu lệnh này"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                  <span>Sửa</span>
                </button>
                <button 
                  type="button"
                  class="btn-copy-vendor px-2 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 transition flex items-center gap-1"
                  data-copy="${escapeAttr(fullCmdText)}"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                  <span>Copy</span>
                </button>
              </div>
            </div>
            <pre class="snippet-pre code-font text-xs text-slate-200 overflow-x-auto p-2.5 rounded bg-slate-900 border border-slate-800 select-all leading-relaxed whitespace-pre">${formattedCmdLines}</pre>
            <textarea class="snippet-editor hidden w-full p-2.5 text-xs code-font bg-slate-950 text-amber-300 rounded border border-amber-500/50 focus:outline-none leading-relaxed resize-y" rows="5">${escapeHtml(fullCmdText)}</textarea>
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

  document.querySelectorAll('.btn-edit-vendor').forEach(editBtn => {
    editBtn.addEventListener('click', () => {
      const block = editBtn.closest('.vendor-cmd-block');
      if (!block) return;
      const pre = block.querySelector('.snippet-pre');
      const editor = block.querySelector('.snippet-editor');
      const copyBtn = block.querySelector('.btn-copy-vendor');
      if (!pre || !editor) return;

      const isEditing = !editor.classList.contains('hidden');
      if (!isEditing) {
        editor.value = pre.textContent;
        const lines = editor.value.split('\n').length;
        editor.rows = Math.max(4, Math.min(18, lines + 1));
        pre.classList.add('hidden');
        editor.classList.remove('hidden');
        editor.focus();
        editBtn.classList.remove('bg-slate-800', 'hover:bg-amber-600', 'text-slate-300');
        editBtn.classList.add('bg-emerald-600', 'text-white');
        editBtn.querySelector('span').textContent = 'Xong';
      } else {
        pre.textContent = editor.value;
        if (copyBtn) copyBtn.setAttribute('data-copy', editor.value);
        editor.classList.add('hidden');
        pre.classList.remove('hidden');
        editBtn.classList.remove('bg-emerald-600', 'text-white');
        editBtn.classList.add('bg-slate-800', 'hover:bg-amber-600', 'text-slate-300');
        editBtn.querySelector('span').textContent = 'Sửa';
        showToast('Đã lưu chỉnh sửa câu lệnh mẫu!');
      }
    });
  });

  document.querySelectorAll('.btn-copy-vendor').forEach(btn => {
    btn.addEventListener('click', () => {
      const block = btn.closest('.vendor-cmd-block');
      const editor = block?.querySelector('.snippet-editor');
      const text = (editor && !editor.classList.contains('hidden')) ? editor.value : btn.getAttribute('data-copy');
      copyText(text, btn);
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

// Render Recovery Playbooks (Detailed Beginner-Friendly Format)
function renderRecoveryPlaybook() {
  const container = document.getElementById('recovery-cards-container');
  if (!container) return;
  container.innerHTML = '';
  RECOVERY_PLAYBOOK_DATA.forEach(item => {
    const card = document.createElement('div');
    card.className = 'bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between card-smooth-fx animate-fade-in-up';

    let stepsHtml = item.steps.map(s => {
      const formatted = escapeHtml(s).replace(/\n/g, '<br>');
      return `<li class="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/70 font-sans whitespace-pre-wrap">${formatted}</li>`;
    }).join('');

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between flex-wrap gap-2 pb-3 mb-3 border-b border-slate-800">
          <span class="text-xs sm:text-sm font-bold px-2.5 py-1 rounded border ${item.icon}">
            ${escapeHtml(item.vendor)}
          </span>
          <button class="btn-copy-recovery text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-emerald-600 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition" data-copy="${escapeAttr(item.steps.join('\n\n'))}">
            Copy toàn bộ hướng dẫn
          </button>
        </div>

        <!-- Meta Badges: Baudrate, Keep Config, Downtime -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3 text-[11px]">
          <div class="bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
            <span class="text-slate-400">Baudrate:</span> <strong class="text-amber-400 font-mono">${escapeHtml(item.baud || '9600 bps')}</strong>
          </div>
          <div class="bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
            <span class="text-slate-400">Thời gian ngắt:</span> <strong class="text-cyan-300">${escapeHtml(item.downtime || '3-5 phút')}</strong>
          </div>
          <div class="bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
            <span class="text-emerald-400 font-semibold">${escapeHtml(item.keepConfig || 'Giữ nguyên cấu hình cũ')}</span>
          </div>
        </div>

        <ol class="space-y-2 list-none">
          ${stepsHtml}
        </ol>

        ${item.warning ? `
          <div class="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 flex items-start gap-2">
            <span class="font-bold shrink-0">⚠️ LƯU Ý QUAN TRỌNG:</span>
            <span>${escapeHtml(item.warning)}</span>
          </div>
        ` : ''}
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
      
      // Update Dynamic Island active pill states
      document.querySelectorAll('.nav-view-btn').forEach(b => {
        b.classList.remove('island-active', 'bg-emerald-600', 'text-white', 'font-bold');
        if (!b.closest('#dropdown-tools-menu')) {
          b.classList.add('text-slate-300');
        }
      });

      const targetViewBtns = document.querySelectorAll(`.nav-view-btn[data-view="${targetViewId}"]`);
      targetViewBtns.forEach(tb => {
        if (!tb.closest('#dropdown-tools-menu')) {
          tb.classList.add('island-active', 'font-bold');
          tb.classList.remove('text-slate-300');
        }
      });

      // Update Dropdown label if clicked from inside dropdown
      const subLabel = btn.querySelector('.font-semibold')?.textContent;
      if (subLabel && labelActiveTool) {
        labelActiveTool.textContent = subLabel;
        btnDropdown.classList.add('text-amber-300', 'bg-slate-900');
      } else if (labelActiveTool && ['view-generator', 'view-showcmds', 'view-subnet', 'view-builder', 'view-diagnose', 'view-mikrotik', 'view-about'].includes(targetViewId)) {
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



  // Vendor Filter + Smart Default Port Sync
  const vendorFilter = document.getElementById('vendor-filter');
  if (vendorFilter) {
    vendorFilter.addEventListener('change', (e) => {
      activeVendor = e.target.value;
      const vp = VENDOR_DEFAULT_PORTS[activeVendor];
      const apInp = document.getElementById('param-access-port');
      const tpInp = document.getElementById('param-trunk-port');
      if (vp && apInp && tpInp) {
        apInp.value = vp.access;
        tpInp.value = vp.trunk;
      }
      renderCards();
    });
  }

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
    if (el) {
      const syncHandler = () => {
        renderCards();
      };
      el.addEventListener('input', syncHandler);
      el.addEventListener('change', syncHandler);
    }
  });

  
  // Stack Mode & Unit ID listeners
  const stackModeEl = document.getElementById('param-stack-mode');
  const stackUnitBox = document.getElementById('param-stack-unit-box');
  const stackUnitEl = document.getElementById('param-stack-unit');
  if (stackModeEl) {
    stackModeEl.addEventListener('change', () => {
      const isStack = stackModeEl.value === 'stack';
      if (stackUnitBox) stackUnitBox.classList.toggle('hidden', !isStack);
      const { unit } = getStackSettings();
      const targetV = activeVendor !== 'ALL' ? activeVendor : 'cisco';
      const apInp = document.getElementById('param-access-port');
      const tpInp = document.getElementById('param-trunk-port');
      if (apInp && tpInp) {
        apInp.value = getVendorSinglePort(targetV, 1, isStack, unit);
        tpInp.value = getVendorSinglePort(targetV, 24, isStack, unit);
      }
      renderCards();
    });
  }
  if (stackUnitEl) {
    const updateUnit = () => {
      const { isStack, unit } = getStackSettings();
      const targetV = activeVendor !== 'ALL' ? activeVendor : 'cisco';
      const apInp = document.getElementById('param-access-port');
      const tpInp = document.getElementById('param-trunk-port');
      if (isStack && apInp && tpInp) {
        apInp.value = getVendorSinglePort(targetV, 1, true, unit);
        tpInp.value = getVendorSinglePort(targetV, 24, true, unit);
      }
      renderCards();
    };
    stackUnitEl.addEventListener('input', updateUnit);
    stackUnitEl.addEventListener('change', updateUnit);
  }

  // Range Port Mode listeners
  const rangeToggle = document.getElementById('param-range-enable');
  const rangeBox = document.getElementById('param-range-inputs');
  const rangeStart = document.getElementById('param-range-start');
  const rangeEnd = document.getElementById('param-range-end');
  if (rangeToggle) {
    rangeToggle.addEventListener('change', () => {
      if (rangeBox) {
        if (rangeToggle.checked) {
          rangeBox.classList.remove('opacity-50', 'pointer-events-none');
        } else {
          rangeBox.classList.add('opacity-50', 'pointer-events-none');
        }
      }
      renderCards();
    });
  }
  [rangeStart, rangeEnd].forEach(inp => {
    if (inp) {
      inp.addEventListener('input', () => renderCards());
      inp.addEventListener('change', () => renderCards());
    }
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


// ==========================================
// QUICK CONFIG BUILDER & TERMINAL SIMULATOR
// ==========================================
let selectedBuilderTaskIds = new Set(['vlan-create', 'access-port', 'admin-ssh', 'save-backup']);
let currentBuilderVendor = 'cisco';
let builderFeatureSearch = '';

function initQuickBuilder() {
  renderBuilderChecklist();
  updateGeneratedScript();

  // Vendor selector change
  const vendorSelect = document.getElementById('builder-vendor-select');
  if (vendorSelect) {
    vendorSelect.addEventListener('change', (e) => {
      currentBuilderVendor = e.target.value;
      const vInfo = VENDORS_INFO[currentBuilderVendor];
      const pill = document.getElementById('builder-vendor-pill');
      if (pill) pill.textContent = vInfo ? vInfo.name : currentBuilderVendor.toUpperCase();
      updateGeneratedScript();
    });
  }

  // Feature search filter
  const searchInput = document.getElementById('builder-feature-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      builderFeatureSearch = e.target.value.toLowerCase().trim();
      renderBuilderChecklist();
    });
  }

  // Preset Buttons
  document.getElementById('btn-preset-access')?.addEventListener('click', () => {
    selectedBuilderTaskIds = new Set(['vlan-create', 'access-port', 'admin-ssh', 'save-backup']);
    renderBuilderChecklist();
    updateGeneratedScript();
    showToast('Đã chọn mẫu Switch Access!');
  });

  document.getElementById('btn-preset-core')?.addEventListener('click', () => {
    selectedBuilderTaskIds = new Set(['vlan-create', 'svi-gateway', 'static-route', 'ospf-single-area', 'dhcp-server-pool', 'admin-ssh', 'save-backup']);
    renderBuilderChecklist();
    updateGeneratedScript();
    showToast('Đã chọn mẫu Switch Core L3!');
  });

  document.getElementById('btn-preset-security')?.addEventListener('click', () => {
    selectedBuilderTaskIds = new Set(['voice-vlan-phone', 'dhcp-snooping-dai', 'snmpv3-secure-monitoring', 'third-party-sfp-unlock', 'save-backup']);
    renderBuilderChecklist();
    updateGeneratedScript();
    showToast('Đã chọn mẫu Chuẩn An Ninh!');
  });

  document.getElementById('btn-builder-clear')?.addEventListener('click', () => {
    selectedBuilderTaskIds.clear();
    renderBuilderChecklist();
    updateGeneratedScript();
    showToast('Đã bỏ chọn toàn bộ!');
  });

  // Toggle params drawer
  document.getElementById('btn-toggle-builder-params')?.addEventListener('click', () => {
    const box = document.getElementById('builder-params-box');
    const label = document.getElementById('label-builder-params');
    if (box) {
      box.classList.toggle('hidden');
      if (label) {
        label.textContent = box.classList.contains('hidden') ? 'Bộ Thông Số Động Dự Án (Đang ẩn - Bấm để mở)' : 'Bộ Thông Số Động Dự Án (Đang mở)';
      }
    }
  });

  // Builder Params Sync button
  document.getElementById('btn-builder-sync-params')?.addEventListener('click', () => {
    // Copy bparam to param
    const mappings = [
      ['bparam-vlan-id', 'param-vlan-id'],
      ['bparam-vlan-name', 'param-vlan-name'],
      ['bparam-access-port', 'param-access-port'],
      ['bparam-trunk-port', 'param-trunk-port'],
      ['bparam-ip-cidr', 'param-ip-cidr'],
      ['bparam-nexthop', 'param-nexthop'],
      ['bparam-user', 'param-user'],
      ['bparam-pass', 'param-pass'],
      ['bparam-subnet', 'param-subnet'],
      ['bparam-mask', 'param-mask'],
      ['bparam-lag-id', 'param-lag-id']
    ];
    mappings.forEach(([bId, pId]) => {
      const bVal = document.getElementById(bId)?.value;
      const pEl = document.getElementById(pId);
      if (bVal && pEl) pEl.value = bVal;
    });
    updateGeneratedScript();
    renderCards();
    showToast('Đã cập nhật thông số động dự án!');
  });

  // Live input change on bparam inputs
  const bParamIds = [
    'bparam-vlan-id', 'bparam-vlan-name', 'bparam-access-port', 'bparam-trunk-port',
    'bparam-ip-cidr', 'bparam-nexthop', 'bparam-user', 'bparam-pass', 'bparam-subnet',
    'bparam-mask', 'bparam-lag-id'
  ];
  bParamIds.forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      updateGeneratedScript();
    });
  });

  // Tab switcher: Script vs Sandbox
  const tabScript = document.getElementById('tab-btn-script');
  const tabSandbox = document.getElementById('tab-btn-sandbox');
  const paneScript = document.getElementById('pane-builder-script');
  const paneSandbox = document.getElementById('pane-builder-sandbox');

  tabScript?.addEventListener('click', () => {
    tabScript.classList.add('bg-emerald-600', 'text-white');
    tabScript.classList.remove('text-slate-400');
    tabSandbox.classList.remove('bg-emerald-600', 'text-white');
    tabSandbox.classList.add('text-slate-400');
    paneScript?.classList.remove('hidden');
    paneSandbox?.classList.add('hidden');
  });

  tabSandbox?.addEventListener('click', () => {
    tabSandbox.classList.add('bg-emerald-600', 'text-white');
    tabSandbox.classList.remove('text-slate-400');
    tabScript.classList.remove('bg-emerald-600', 'text-white');
    tabScript.classList.add('text-slate-400');
    paneSandbox?.classList.remove('hidden');
    paneScript?.classList.add('hidden');
  });

  // Copy builder script
  document.getElementById('btn-copy-builder-script')?.addEventListener('click', () => {
    const pre = document.getElementById('builder-script-output');
    if (pre) copyText(pre.textContent, document.getElementById('btn-copy-builder-script'));
  });

  // Download .cfg file
  document.getElementById('btn-download-builder-cfg')?.addEventListener('click', () => {
    const text = document.getElementById('builder-script-output')?.textContent || '';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `config_${currentBuilderVendor}_${Date.now()}.cfg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Đã tải file kịch bản cấu hình .cfg!');
  });

  // Terminal Simulator Simulation button
  document.getElementById('btn-run-simulation')?.addEventListener('click', runTerminalSimulation);
  document.getElementById('btn-clear-sandbox')?.addEventListener('click', () => {
    const screen = document.getElementById('terminal-screen');
    if (screen) {
      screen.innerHTML = `
        <div class="text-slate-500">Terminal cleared. Connected to virtual console [115200 8-N-1].</div>
        <div class="text-emerald-400 mt-2 font-bold" id="terminal-prompt">Switch# <span class="animate-pulse">_</span></div>
      `;
    }
  });
}

function renderBuilderChecklist() {
  const container = document.getElementById('builder-checklist-container');
  if (!container || !CORE_TASKS.length) return;
  container.innerHTML = '';

  let countSelected = 0;

  const categoryNames = {
    l2: 'L2 Switching',
    l3: 'L3 Routing & FHRP',
    dynamic: 'Định Tuyến Động',
    services: 'Dịch Vụ Mạng',
    sec: 'Bảo Mật & NAT',
    vpn: 'VPN Tunnels',
    mgmt: 'Quản Trị & Lưu',
    ts: 'Troubleshoot',
    hw: 'Phần Cứng & SFP'
  };

  CORE_TASKS.forEach(task => {
    if (builderFeatureSearch) {
      const matchTitle = task.title.toLowerCase().includes(builderFeatureSearch);
      const matchDesc = task.desc.toLowerCase().includes(builderFeatureSearch);
      if (!matchTitle && !matchDesc) return;
    }

    const isChecked = selectedBuilderTaskIds.has(task.id);
    if (isChecked) countSelected++;

    const item = document.createElement('label');
    item.className = `flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition select-none ${isChecked ? 'bg-slate-900 border-emerald-500/50 text-white' : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'}`;

    item.innerHTML = `
      <input type="checkbox" class="builder-cb mt-1 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer" data-id="${escapeAttr(task.id)}" ${isChecked ? 'checked' : ''}>
      <div class="flex-1">
        <div class="flex items-center justify-between gap-1">
          <span class="font-semibold text-xs text-white">${escapeHtml(task.title)}</span>
          <span class="text-[9px] px-1.5 py-0.2 rounded uppercase font-bold text-slate-400 bg-slate-800">${escapeHtml(categoryNames[task.category] || task.category)}</span>
        </div>
        <p class="text-[11px] text-slate-400 mt-0.5 line-clamp-1">${escapeHtml(task.desc)}</p>
      </div>
    `;

    const cb = item.querySelector('.builder-cb');
    cb.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedBuilderTaskIds.add(task.id);
      } else {
        selectedBuilderTaskIds.delete(task.id);
      }
      renderBuilderChecklist();
      updateGeneratedScript();
    });

    container.appendChild(item);
  });

  const countBadge = document.getElementById('builder-selected-count');
  if (countBadge) countBadge.textContent = `${countSelected} Đã chọn`;
}

function getBuilderParams() {
  const vlanId = document.getElementById('bparam-vlan-id')?.value || document.getElementById('param-vlan-id')?.value || '10';
  const vlanName = document.getElementById('bparam-vlan-name')?.value || document.getElementById('param-vlan-name')?.value || 'DATA_LAN';
  const accessPort = document.getElementById('bparam-access-port')?.value || document.getElementById('param-access-port')?.value || 'ge-0/0/1';
  const trunkPort = document.getElementById('bparam-trunk-port')?.value || document.getElementById('param-trunk-port')?.value || 'ge-0/0/24';
  const ipCidr = document.getElementById('bparam-ip-cidr')?.value || document.getElementById('param-ip-cidr')?.value || '192.168.10.1/24';
  const nextHop = document.getElementById('bparam-nexthop')?.value || document.getElementById('param-nexthop')?.value || '192.168.1.1';
  const user = document.getElementById('bparam-user')?.value || document.getElementById('param-user')?.value || 'itadmin';
  const pass = document.getElementById('bparam-pass')?.value || document.getElementById('param-pass')?.value || 'NetAdmin@2026!';
  const netmask = document.getElementById('bparam-mask')?.value || document.getElementById('param-mask')?.value || '255.255.255.0';
  const subnet = document.getElementById('bparam-subnet')?.value || document.getElementById('param-subnet')?.value || '192.168.10.0';
  const lagId = document.getElementById('bparam-lag-id')?.value || document.getElementById('param-lag-id')?.value || '1';

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

function replaceBuilderParams(str) {
  const params = getBuilderParams();
  let res = str;
  for (const [k, v] of Object.entries(params)) {
    res = res.split(k).join(v);
  }
  return res;
}

function updateGeneratedScript() {
  const outputPre = document.getElementById('builder-script-output');
  const linesCountSpan = document.getElementById('builder-script-lines-count');
  if (!outputPre) return;

  if (selectedBuilderTaskIds.size === 0) {
    outputPre.textContent = '# Chưa có tính năng nào được chọn. Hãy tick chọn các tính năng ở cột bên trái!';
    if (linesCountSpan) linesCountSpan.textContent = '0 dòng lệnh';
    return;
  }

  const vInfo = VENDORS_INFO[currentBuilderVendor] || { name: currentBuilderVendor.toUpperCase() };
  let scriptLines = [];
  const now = new Date().toISOString().substring(0, 10);

  scriptLines.push(`! =========================================================`);
  scriptLines.push(`! KỊCH BẢN CẤU HÌNH TỰ ĐỘNG CHO: ${vInfo.name.toUpperCase()}`);
  scriptLines.push(`! Ngày sinh: ${now} | Thiết bị: TraceDeck`);
  scriptLines.push(`! Thông số: VLAN ${getBuilderParams()['{{VLAN_ID}}']} (${getBuilderParams()['{{VLAN_NAME}}']}) | Gateway: ${getBuilderParams()['{{IP_CIDR}}']}`);
  scriptLines.push(`! =========================================================\n`);

  let addedTasks = 0;

  CORE_TASKS.forEach(task => {
    if (selectedBuilderTaskIds.has(task.id)) {
      const vData = task.vendors[currentBuilderVendor];
      if (vData && vData.cmds && vData.cmds.length > 0) {
        addedTasks++;
        scriptLines.push(`! --- [${task.title}] ---`);
        if (vData.note) {
          scriptLines.push(`! Ghi chú: ${vData.note}`);
        }
        vData.cmds.forEach(c => {
          scriptLines.push(replaceBuilderParams(c));
        });
        scriptLines.push(``); // empty line separator
      }
    }
  });

  const fullText = scriptLines.join('\n');
  outputPre.textContent = fullText;
  if (linesCountSpan) {
    const totalLines = fullText.split('\n').filter(l => l.trim() && !l.trim().startsWith('!')).length;
    linesCountSpan.textContent = `${totalLines} dòng lệnh thực thi (${addedTasks} tính năng)`;
  }
}

// Terminal Interactive Simulation
let isSimulating = false;

function runTerminalSimulation() {
  if (isSimulating) return;
  const screen = document.getElementById('terminal-screen');
  if (!screen) return;

  const rawScript = document.getElementById('builder-script-output')?.textContent || '';
  const lines = rawScript.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('!') && !l.startsWith('#'));

  if (lines.length === 0) {
    showToast('Vui lòng chọn ít nhất 1 tính năng để có lệnh chạy thử!');
    return;
  }

  isSimulating = true;
  screen.innerHTML = `
    <div class="text-slate-400 font-bold border-b border-slate-800 pb-2">
      [*] Khởi động phiên mô phỏng giả lập Console [Baud: 115200 8-N-1]...
    </div>
    <div class="text-emerald-400 mt-2 font-bold">Switch# <span class="text-slate-400 font-normal">paste commands below</span></div>
  `;

  let promptPrefix = 'Switch(config)#';
  if (currentBuilderVendor === 'huawei') promptPrefix = '[Huawei]';
  else if (currentBuilderVendor === 'juniper') promptPrefix = 'root@switch#';
  else if (currentBuilderVendor === 'fortinet') promptPrefix = 'FortiGate (global) #';
  else if (currentBuilderVendor === 'mikrotik') promptPrefix = '[admin@MikroTik] >';

  let idx = 0;

  function executeNextLine() {
    if (idx >= lines.length) {
      isSimulating = false;
      const doneDiv = document.createElement('div');
      doneDiv.className = 'mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 font-bold';
      doneDiv.innerHTML = `
        <div class="flex items-center gap-2">
          <span>✓</span>
          <span>MÔ PHỎNG HOÀN TẤT THÀNH CÔNG!</span>
        </div>
        <div class="text-xs text-slate-300 font-normal mt-1">
          Cú pháp hợp lệ 100%, không phát hiện lỗi xung đột. Bạn có thể tự tin copy toàn bộ kịch bản này vào cổng Console thiết bị thật!
        </div>
      `;
      screen.appendChild(doneDiv);
      screen.scrollTop = screen.scrollHeight;
      return;
    }

    const currentLine = lines[idx];
    idx++;

    const lineDiv = document.createElement('div');
    lineDiv.className = 'flex items-start gap-2 text-slate-100';
    lineDiv.innerHTML = `
      <span class="text-cyan-400 font-bold shrink-0">${promptPrefix}</span>
      <span class="text-emerald-300 select-all font-mono">${escapeHtml(currentLine)}</span>
    `;
    screen.appendChild(lineDiv);

    // Dynamic responses for realism
    if (currentLine.includes('interface') || currentLine.includes('vlan')) {
      promptPrefix = currentBuilderVendor === 'cisco' ? 'Switch(config-if)#' : promptPrefix;
    } else if (currentLine.includes('exit') || currentLine.includes('quit') || currentLine.includes('end')) {
      promptPrefix = 'Switch(config)#';
    } else if (currentLine.includes('write memory') || currentLine.includes('copy run start')) {
      const respDiv = document.createElement('div');
      respDiv.className = 'text-slate-400 italic text-[11px] pl-4';
      respDiv.textContent = 'Building configuration... [OK] Write to FLASH finished successfully.';
      screen.appendChild(respDiv);
    } else if (currentLine.includes('commit')) {
      const respDiv = document.createElement('div');
      respDiv.className = 'text-slate-400 italic text-[11px] pl-4';
      respDiv.textContent = 'commit complete.';
      screen.appendChild(respDiv);
    }

    screen.scrollTop = screen.scrollHeight;
    setTimeout(executeNextLine, 120);
  }

  setTimeout(executeNextLine, 200);
}


// ==========================================
// NETWORK DIAGNOSTIC ASSISTANT & OPTIMIZER (TELNET & SSH)
// ==========================================

const SAMPLE_AUDIT_LOGS = {
  perfect: `hostname Core-Switch-01
spanning-tree mode rapid-pvst
spanning-tree portfast default
spanning-tree portfast bpduguard default
clock timezone ICT 7 0
ntp server vn.pool.ntp.org
archive
 path flash:backup-config
 write-memory
line vty 0 4
 transport input ssh
 login local
no ip http server
ip http secure-server
interface GigabitEthernet0/1
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30
# Hardware Interface Check:
# 0 input errors, 0 CRC, 0 frame, 0 drop
# Spanning-tree status: Forwarding, Topology change: 0
# CPU utilization: 4%, Memory free: 88%`,

  suboptimal: `hostname Switch-Access-Floor3
# Cấu hình còn nhiều điểm chưa tối ưu và tiềm ẩn rủi ro bảo mật:
snmp-server community public RO
line vty 0 4
 transport input telnet
 login local
# Thiếu cấu hình BPDU Guard trên các cổng Access
interface FastEthernet0/1
 switchport mode access
 switchport access vlan 10
# Chưa cấu hình đồng bộ giờ NTP
# Chưa có cơ chế archive tự động lưu cấu hình`,

  critical: `%SW_MATM-4-MACFLAP_NOTIF: Host 0014.22a5.9810 in vlan 10 is flapping between port Gi0/1 and port Gi0/24
%SW_MATM-4-MACFLAP_NOTIF: Host 0014.22a5.9810 in vlan 10 is flapping between port Gi0/24 and port Gi0/1
%PM-4-ERR_DISABLE: bpduguard error detected on Gi0/1, putting Gi0/1 in err-disable state
GigabitEthernet0/24 is up, line protocol is up (connected)
  54219 packets input, 45291241 bytes, 0 no buffer
  1429 input errors, 1429 CRC, 0 frame, 0 overrun, 0 ignored
BGP neighbor is 203.0.113.1, remote AS 65002, BGP state = Active
Failed TCP connect attempts: 18`
};

let currentOptimizerScript = '';

function initDiagnosticAssistant() {

  // Multi-Vendor One-Shot Collector Engine (Clean \n, No semicolons)
  const ONESHOT_BY_VENDOR = {
    cisco: [
      "terminal length 0",
      "show version",
      "show ip interface brief",
      "show interfaces status",
      "show interfaces description",
      "show spanning-tree summary",
      "show processes cpu sorted | exclude 0.00%",
      "show logging | last 50",
      "terminal length 24"
    ].join('\n'),

    ciscocbs: [
      "terminal datadump",
      "show system",
      "show version",
      "show ip interface",
      "show interfaces status",
      "show interfaces switchport",
      "show spanning-tree",
      "show cpu utilization",
      "show logging",
      "terminal no datadump"
    ].join('\n'),

    juniper: [
      "set cli screen-length 0",
      "show version",
      "show interfaces terse",
      "show route",
      "show system uptime",
      "show chassis routing-engine",
      "show log messages | last 40",
      "set cli screen-length 24"
    ].join('\n'),

    fortinet: [
      "config system console",
      "set output standard",
      "end",
      "get system status",
      "get system performance status",
      "get system interface physical",
      "get router info routing-table all",
      "execute log display"
    ].join('\n'),

    huawei: [
      "screen-length 0 temporary",
      "display version",
      "display ip interface brief",
      "display interface brief",
      "display ip routing-table",
      "display cpu-usage",
      "display logbuffer"
    ].join('\n'),

    mikrotik: [
      "/system resource print",
      "/ip address print",
      "/interface print stats",
      "/ip route print",
      "/log print where topics~\"error|warning\"",
      "/tool profile duration=5s"
    ].join('\n'),

    aruba: [
      "no page",
      "show version",
      "show ip interface brief",
      "show interface brief",
      "show lldp neighbor-info",
      "show logging -r -n 40"
    ].join('\n'),

    ruijie: [
      "terminal length 0",
      "show version",
      "show ip interface brief",
      "show interfaces status",
      "show cpu",
      "show logging",
      "terminal length 24"
    ].join('\n'),

    edgecore: [
      "terminal length 0",
      "show system",
      "show version",
      "show ip interface",
      "show interfaces status",
      "show spanning-tree",
      "show process cpu",
      "show logging",
      "terminal length 24"
    ].join('\n'),

    draytek: [
      "sys version",
      "sys health",
      "show status",
      "wan status",
      "show lan",
      "ip route",
      "srv dhcp status",
      "log"
    ].join('\n')
  };

  const oneshotVendorSelect = document.getElementById('diag-oneshot-vendor');
  const oneshotPreview = document.getElementById('diag-oneshot-preview');

  function updateOneshotPreview() {
    const v = oneshotVendorSelect?.value || 'cisco';
    const lines = (ONESHOT_BY_VENDOR[v] || ONESHOT_BY_VENDOR.cisco).split('\n');
    if (oneshotPreview) {
      oneshotPreview.textContent = lines.slice(0, 3).join('  ➔  ') + '  ... (' + lines.length + ' lệnh)';
    }
  }

  oneshotVendorSelect?.addEventListener('change', updateOneshotPreview);
  updateOneshotPreview();

  document.getElementById('btn-copy-collector-cmd')?.addEventListener('click', () => {
    const v = oneshotVendorSelect?.value || 'cisco';
    const cmdStr = ONESHOT_BY_VENDOR[v] || ONESHOT_BY_VENDOR.cisco;
    copyText(cmdStr, document.getElementById('btn-copy-collector-cmd'));
    const vName = oneshotVendorSelect?.options[oneshotVendorSelect.selectedIndex]?.text || v;
    showToast(`Đã copy bộ lệnh quét chuẩn ${vName}! Dán thẳng vào console.`);
  });

  // Mode toggles
  const btnPaste = document.getElementById('diag-mode-paste');
  const btnSsh = document.getElementById('diag-mode-ssh');
  const panePaste = document.getElementById('diag-pane-paste');
  const paneSsh = document.getElementById('diag-pane-ssh');

  btnPaste?.addEventListener('click', () => {
    btnPaste.classList.add('bg-rose-600', 'text-white');
    btnPaste.classList.remove('text-slate-400');
    btnSsh.classList.remove('bg-rose-600', 'text-white');
    btnSsh.classList.add('text-slate-400');
    panePaste?.classList.remove('hidden');
    paneSsh?.classList.add('hidden');
  });

  btnSsh?.addEventListener('click', () => {
    btnSsh.classList.add('bg-rose-600', 'text-white');
    btnSsh.classList.remove('text-slate-400');
    btnPaste.classList.remove('bg-rose-600', 'text-white');
    btnPaste.classList.add('text-slate-400');
    paneSsh?.classList.remove('hidden');
    panePaste?.classList.add('hidden');
  });

  // Remote Protocol Selector (SSH vs Telnet port auto-switch)
  const protoSelect = document.getElementById('remote-protocol-select');
  const portInput = document.getElementById('ssh-target-port');
  protoSelect?.addEventListener('change', (e) => {
    if (portInput) {
      portInput.value = e.target.value === 'TELNET' ? '23' : '22';
    }
  });

  // Sample Audit Presets
  document.querySelectorAll('.btn-sample-audit').forEach(btn => {
    btn.addEventListener('click', () => {
      const sampleKey = btn.getAttribute('data-sample');
      const textarea = document.getElementById('diag-raw-input');
      if (textarea && SAMPLE_AUDIT_LOGS[sampleKey]) {
        textarea.value = SAMPLE_AUDIT_LOGS[sampleKey];
        showToast('Đã nạp: ' + btn.textContent.trim());
      }
    });
  });

  // Clear input
  document.getElementById('btn-clear-diag-input')?.addEventListener('click', () => {
    const textarea = document.getElementById('diag-raw-input');
    if (textarea) textarea.value = '';
    document.getElementById('diag-results-box')?.classList.add('hidden');
  });

  // Run Diagnosis / Audit
  document.getElementById('btn-run-diagnosis')?.addEventListener('click', runAuditDiagnosis);

  // Live Remote SSH / Telnet probe simulation
  document.getElementById('btn-run-ssh-probe')?.addEventListener('click', () => {
    const ip = document.getElementById('ssh-target-ip')?.value.trim();
    const proto = protoSelect?.value || 'SSH';
    const port = portInput?.value || (proto === 'TELNET' ? '23' : '22');

    if (!ip) {
      showToast('Vui lòng nhập địa chỉ IP!');
      return;
    }

    showToast(`Đang mở phiên ${proto} tới ${ip}:${port}...`);
    setTimeout(() => {
      const textarea = document.getElementById('diag-raw-input');
      if (textarea) textarea.value = SAMPLE_AUDIT_LOGS.suboptimal;
      btnPaste?.click();
      runAuditDiagnosis(proto, ip);
    }, 1200);
  });

  // Optimizer Modal open/close
  document.getElementById('btn-open-optimizer')?.addEventListener('click', () => {
    const modal = document.getElementById('modal-optimizer');
    const pre = document.getElementById('optimizer-script-output');
    if (pre) pre.textContent = currentOptimizerScript || '! Không có kịch bản tối ưu hóa nào.';
    modal?.classList.remove('hidden');
  });

  document.getElementById('btn-close-optimizer')?.addEventListener('click', () => {
    document.getElementById('modal-optimizer')?.classList.add('hidden');
  });

  // Copy Optimizer Script
  document.getElementById('btn-copy-optimizer-script')?.addEventListener('click', () => {
    if (currentOptimizerScript) {
      copyText(currentOptimizerScript, document.getElementById('btn-copy-optimizer-script'));
    }
  });
}

async function runAuditDiagnosis(protocol = 'MANUAL', ip = '') {
  const rawText = document.getElementById('diag-raw-input')?.value.trim();
  if (!rawText) {
    showToast('Vui lòng dán cấu hình hoặc log cần phân tích!');
    return;
  }

  showToast('AI đang rà soát và kiểm định cấu hình...');

  let auditData = null;

  try {
    const res = await fetch('/api/diagnose/audit-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configText: rawText, protocol, ip, vendor: document.getElementById('diag-oneshot-vendor')?.value || 'AUTO' })
    });
    auditData = await res.json();
  } catch (err) {
    auditData = fallbackClientAudit(rawText, protocol, ip);
  }

  renderAuditReport(auditData);
}

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
    if (v === 'cisco' || v === 'ruijie') fixScript = 'clock timezone ICT 7 0\nntp server vn.pool.ntp.org';
    else if (v === 'ciscocbs') fixScript = 'clock timezone ICT +7\nsntp unicast client enable\nsntp server vn.pool.ntp.org';
    else if (v === 'huawei') fixScript = 'clock timezone ICT add 07:00:00\nntp-service unicast-server vn.pool.ntp.org';
    else if (v === 'aruba') fixScript = 'clock timezone Asia/Ho_Chi_Minh\nntp server vn.pool.ntp.org\nntp enable';
    else if (v === 'juniper') fixScript = 'set system time-zone Asia/Ho_Chi_Minh\nset system ntp server vn.pool.ntp.org';
    else if (v === 'mikrotik') fixScript = '/system clock set time-zone-name=Asia/Ho_Chi_Minh\n/system ntp client set enabled=yes servers=vn.pool.ntp.org';
    else if (v === 'fortinet') fixScript = 'config system ntp\n set ntpsync enable\n set type custom\n config ntpserver\n  edit 1\n   set server "vn.pool.ntp.org"\n  next\n end\nend';
    else fixScript = 'ntp server vn.pool.ntp.org';

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
  const execPosts = issues.map(i => i.execPostCmd).filter(Boolean);
  let optLines = [];
  if (v === 'mikrotik') {
    optLines.push(`# KICH BAN OPTIMIZER - MIKROTIK ROUTEROS (CHUẨN CÚ PHÁP)`);
    issues.forEach(i => { optLines.push(`# ${i.title}`); optLines.push(i.fixScript); optLines.push(''); });
  } else if (v === 'juniper') {
    optLines.push(`# KICH BAN OPTIMIZER - JUNIPER JUNOS`);
    optLines.push(`configure`);
    issues.forEach(i => { optLines.push(`# ${i.title}`); optLines.push(i.fixScript); optLines.push(''); });
    optLines.push(`commit and-quit`);
  } else if (v === 'fortinet') {
    optLines.push(`# KICH BAN OPTIMIZER - FORTIGATE FORTIOS`);
    issues.forEach(i => { optLines.push(`# ${i.title}`); optLines.push(i.fixScript); optLines.push(''); });
  } else if (v === 'huawei') {
    optLines.push(`# KICH BAN OPTIMIZER - HUAWEI VRP (NHẬN DIỆN: ${faultyIntf})`);
    optLines.push(`system-view`);
    issues.forEach(i => { optLines.push(`# ${i.title}`); optLines.push(i.fixScript); optLines.push(''); });
    optLines.push(`return`);
    execPosts.forEach(c => optLines.push(c));
    optLines.push(`save`);
  } else if (v === 'ciscocbs') {
    optLines.push(`! KICH BAN OPTIMIZER - CISCO BUSINESS CBS (NHẬN DIỆN: ${faultyIntf})`);
    optLines.push(`configure`);
    issues.forEach(i => { optLines.push(`! ${i.title}`); optLines.push(i.fixScript); optLines.push(''); });
    optLines.push(`end`);
    execPosts.forEach(c => optLines.push(c));
    optLines.push(`copy running-config startup-config`);
  } else {
    optLines.push(`! KICH BAN OPTIMIZER - ${v.toUpperCase()} (NHẬN DIỆN: ${faultyIntf})`);
    optLines.push(`configure terminal`);
    issues.forEach(i => { optLines.push(`! ${i.title}`); optLines.push(i.fixScript); optLines.push(''); });
    optLines.push(`end`);
    execPosts.forEach(c => optLines.push(c));
    optLines.push(`write memory`);
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

function fallbackClientAudit(text, protocol, ip) {
  const hintedVendor = document.getElementById('diag-oneshot-vendor')?.value || 'AUTO';
  return buildSmartAudit(text, hintedVendor);
}

function renderAuditReport(data) {
  const box = document.getElementById('diag-results-box');
  const scoreCircle = document.getElementById('diag-score-circle');
  const scoreNum = document.getElementById('diag-score-num');
  const gradeBadge = document.getElementById('diag-grade-badge');
  const assessText = document.getElementById('diag-assessment-text');
  const goodSection = document.getElementById('diag-good-section');
  const goodList = document.getElementById('diag-good-list');
  const issuesSection = document.getElementById('diag-issues-section');
  const issuesList = document.getElementById('diag-issues-list');

  if (!box || !data) return;
  box.classList.remove('hidden');

  currentOptimizerScript = data.optimizerScript || '';

  // Score Number
  if (scoreNum) scoreNum.textContent = data.healthScore;

  // Grade Badge & Circle Styling
  if (data.healthScore >= 90) {
    scoreCircle.className = 'w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black text-xl border border-emerald-500/50 bg-emerald-950/60 text-emerald-400 shadow-emerald-500/10 shrink-0';
    gradeBadge.className = 'px-2.5 py-0.5 rounded text-xs font-bold border bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  } else if (data.healthScore >= 70) {
    scoreCircle.className = 'w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black text-xl border border-amber-500/50 bg-amber-950/60 text-amber-400 shadow-amber-500/10 shrink-0';
    gradeBadge.className = 'px-2.5 py-0.5 rounded text-xs font-bold border bg-amber-500/20 text-amber-300 border-amber-500/40';
  } else {
    scoreCircle.className = 'w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black text-xl border border-rose-500/50 bg-rose-950/60 text-rose-400 shadow-rose-500/10 shrink-0';
    gradeBadge.className = 'px-2.5 py-0.5 rounded text-xs font-bold border bg-rose-500/20 text-rose-300 border-rose-500/40';
  }
  gradeBadge.textContent = data.grade;

  if (assessText) assessText.textContent = data.assessment;

  // Render Plain-language Reality Summary & 4 Vital Questions
  const whatEl = document.getElementById('diag-what-happening');
  if (whatEl && data.whatIsHappening) {
    whatEl.innerHTML = `<span class="font-bold text-cyan-300">📌 Nhận Định Thực Tế: </span>` + escapeHtml(data.whatIsHappening);
  }

  const fourGrid = document.getElementById('diag-four-answers');
  if (fourGrid && data.fourAnswers) {
    fourGrid.innerHTML = data.fourAnswers.map(ans => {
      let icon = '🟢';
      let border = 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300';
      if (ans.status === 'danger') {
        icon = '🔴';
        border = 'border-rose-500/40 bg-rose-950/40 text-rose-300';
      } else if (ans.status === 'warning') {
        icon = '🟡';
        border = 'border-amber-500/40 bg-amber-950/40 text-amber-300';
      }

      return `
        <div class="p-3.5 rounded-xl border ${border} space-y-1">
          <div class="font-bold text-xs text-white flex items-center gap-1.5">
            <span>${icon}</span>
            <span>${escapeHtml(ans.q)}</span>
          </div>
          <p class="text-xs font-sans leading-relaxed text-slate-200">${escapeHtml(ans.answer)}</p>
        </div>
      `;
    }).join('');
  }

  // Render Verified Good points (Cấu hình chuẩn)
  if (goodList && data.verifiedGood && data.verifiedGood.length > 0) {
    goodSection.classList.remove('hidden');
    goodList.innerHTML = data.verifiedGood.map(item => `
      <div class="flex items-center gap-2">
        <span class="text-emerald-400 font-bold shrink-0">✓</span>
        <span>${escapeHtml(item)}</span>
      </div>
    `).join('');
  } else if (goodSection) {
    goodSection.classList.add('hidden');
  }

  // Render Issues
  if (issuesList) {
    issuesList.innerHTML = '';
    if (!data.issues || data.issues.length === 0) {
      issuesSection.classList.add('hidden');
    } else {
      issuesSection.classList.remove('hidden');
      data.issues.forEach(iss => {
        const card = document.createElement('div');
        const borderColor = iss.severity === 'critical' ? 'border-rose-500/40' : 'border-amber-500/40';
        card.className = `bg-slate-950 border ${borderColor} rounded-xl p-4.5 space-y-3 card-smooth-fx animate-fade-in-up`;

        card.innerHTML = `
          <div class="flex items-start justify-between gap-3 pb-2 border-b border-slate-800">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase ${iss.severity === 'critical' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">
                  ${escapeHtml(iss.category)}
                </span>
                <h4 class="text-sm font-bold text-white">${escapeHtml(iss.title)}</h4>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div class="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <span class="font-bold text-amber-400 block mb-1">🔍 Hiện tượng &amp; Ảnh hưởng:</span>
              <p class="text-slate-300 leading-relaxed">${escapeHtml(iss.symptom)}</p>
            </div>
            <div class="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <span class="font-bold text-rose-400 block mb-1">⚠️ Nguyên nhân gốc rễ:</span>
              <p class="text-slate-300 leading-relaxed">${escapeHtml(iss.rootCause)}</p>
            </div>
          </div>

          <!-- Đơn thuốc khắc phục -->
          <div class="bg-slate-900 p-3 rounded-lg border border-emerald-500/30">
            <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
              <span class="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <span>💊 Đơn Thuốc Lệnh Khắc Phục:</span>
              </span>
              <button class="btn-copy-fix px-2.5 py-1 text-[11px] font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1" data-copy="${escapeAttr(iss.fixScript)}">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                <span>Copy Lệnh</span>
              </button>
            </div>
            <pre class="code-font text-xs text-emerald-300 leading-relaxed overflow-x-auto whitespace-pre p-1.5">${escapeHtml(iss.fixScript)}</pre>
            <div class="text-[11px] text-slate-400 mt-2 font-sans">
              💡 <strong>Khuyến nghị:</strong> ${escapeHtml(iss.recommendation)}
            </div>
          </div>
        `;
        issuesList.appendChild(card);
      });

      document.querySelectorAll('.btn-copy-fix').forEach(btn => {
        btn.addEventListener('click', () => {
          copyText(btn.getAttribute('data-copy'), btn);
        });
      });
    }
  }

  box.scrollIntoView({ behavior: 'smooth' });
}


// ==========================================
// MIKROTIK ROUTEROS SUITE CLIENT LOGIC
// ==========================================
let MTCINE_DATA = { modules: [], troubleshoot: [] };
let activeMtModuleId = 'pppoe-multiwan';
let pppoeWanCount = 1;

async function initMikroTikSuite() {
  try {
    const res = await safeFetchJson('/api/mikrotik/mtcine', { modules: [], troubleshoot: [] });
    if (res.ok && res.data) {
      MTCINE_DATA = res.data;
    }
  } catch (err) {
    console.warn('Cannot fetch MikroTik API:', err);
  }

  if (MTCINE_DATA.modules && MTCINE_DATA.modules.length > 0 && !MTCINE_DATA.modules.some(m => m.id === activeMtModuleId)) {
    activeMtModuleId = MTCINE_DATA.modules[0].id;
  }

  renderMtCineModules();
  renderMtCineTroubleshoot();
  updateMtCineScript();

  // PPPoE Dynamic WAN Adder
  document.getElementById('btn-add-pppoe-wan')?.addEventListener('click', () => {
    const container = document.getElementById('mt-pppoe-wan-container');
    if (!container) return;

    pppoeWanCount++;
    const row = document.createElement('div');
    row.className = 'pppoe-wan-row grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-950 p-2.5 rounded-lg border border-slate-800 animate-fade-in-up';
    row.setAttribute('data-wan-idx', pppoeWanCount);

    row.innerHTML = `
      <div class="sm:col-span-2">
        <span class="font-bold text-sky-400 text-xs flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
          <span>WAN ${pppoeWanCount} (PPPoE)</span>
        </span>
      </div>
      <div class="sm:col-span-3">
        <input type="text" placeholder="PPPoE Username" value="wan${pppoeWanCount}_user" class="pppoe-user w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-sky-300 focus:outline-none focus:border-sky-500">
      </div>
      <div class="sm:col-span-3">
        <input type="text" placeholder="PPPoE Password" value="Pass@${pppoeWanCount}" class="pppoe-pass w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-sky-300 focus:outline-none focus:border-sky-500">
      </div>
      <div class="sm:col-span-3">
        <input type="text" placeholder="Interface" value="ether${pppoeWanCount}" class="pppoe-intf w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-emerald-300 focus:outline-none focus:border-sky-500">
      </div>
      <div class="sm:col-span-1 text-center">
        <button type="button" class="btn-remove-wan text-xs text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 transition" title="Xóa đường WAN này">✕</button>
      </div>
    `;

    row.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => updateMtCineScript());
    });

    row.querySelector('.btn-remove-wan')?.addEventListener('click', () => {
      row.remove();
      updateMtCineScript();
      showToast('Đã xóa đường WAN');
    });

    container.appendChild(row);
    updateMtCineScript();
    showToast(`Đã thêm WAN ${pppoeWanCount}!`);
  });

  // Attach input listener to default WAN 1 row
  document.querySelectorAll('.pppoe-wan-row input').forEach(inp => {
    inp.addEventListener('input', () => updateMtCineScript());
  });

  // Parameter inputs change listener
  const mtInputIds = ['mt-sfp-port', 'mt-dns-servers', 'mt-dhcp-pool', 'mt-lan-subnet', 'mt-lan-ip', 'mt-total-dl', 'mt-total-ul', 'mt-custom-params'];
  mtInputIds.forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      updateMtCineScript();
    });
  });

  // Copy button
  document.getElementById('btn-copy-all-mtcine')?.addEventListener('click', () => {
    const text = document.getElementById('mtcine-rsc-output')?.textContent || '';
    copyText(text, document.getElementById('btn-copy-all-mtcine'));
  });

  // Download .rsc button
  document.getElementById('btn-download-mtcine-rsc')?.addEventListener('click', () => {
    const text = document.getElementById('mtcine-rsc-output')?.textContent || '';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mikrotik_${activeMtModuleId}_${Date.now()}.rsc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Đã tải xuống file cấu hình MikroTik .rsc!');
  });
}

function getPppoeWanData() {
  const rows = document.querySelectorAll('.pppoe-wan-row');
  const wans = [];
  rows.forEach((row, idx) => {
    const user = row.querySelector('.pppoe-user')?.value || `user_wan${idx+1}`;
    const pass = row.querySelector('.pppoe-pass')?.value || `Pass@${idx+1}`;
    const intf = row.querySelector('.pppoe-intf')?.value || `ether${idx+1}`;
    wans.push({ idx: idx + 1, user, pass, intf, name: `pppoe-out${idx+1}` });
  });
  if (wans.length === 0) {
    wans.push({ idx: 1, user: 'viettel_wan1', pass: 'Pass@123', intf: 'ether1', name: 'pppoe-out1' });
  }
  return wans;
}

function generatePppoeScripts() {
  const wans = getPppoeWanData();
  let dialerLines = ['/interface pppoe-client'];
  let natLines = ['/ip firewall nat'];

  wans.forEach((w, i) => {
    dialerLines.push(`add name="${w.name}" interface=${w.intf} user="${w.user}" password="${w.pass}" add-default-route=yes default-route-distance=${i+1} disabled=no comment="PPPoE WAN ${w.idx}"`);
    natLines.push(`add chain=srcnat out-interface="${w.name}" action=masquerade comment="NAT Masquerade ${w.name}"`);
  });

  return {
    dialer: dialerLines.join('\n'),
    nat: natLines.join('\n')
  };
}

function getMtParams() {
  const pppoe = generatePppoeScripts();
  const sfpPort = document.getElementById('mt-sfp-port')?.value || 'sfp-sfpplus1';
  const dnsServers = document.getElementById('mt-dns-servers')?.value || '8.8.8.8, 1.1.1.1';
  const dhcpPool = document.getElementById('mt-dhcp-pool')?.value || '192.168.88.10-192.168.88.200';
  const lanSubnet = document.getElementById('mt-lan-subnet')?.value || '192.168.88.0';
  const lanIp = document.getElementById('mt-lan-ip')?.value || '192.168.88.1';
  const totalDl = document.getElementById('mt-total-dl')?.value || '150';
  const totalUl = document.getElementById('mt-total-ul')?.value || '80';

  const params = {
    '{{SFP_PORT}}': sfpPort,
    '{{DNS_SERVERS}}': dnsServers,
    '{{DHCP_POOL}}': dhcpPool,
    '{{LAN_SUBNET}}': lanSubnet,
    '{{LAN_IP}}': lanIp,
    '{{TOTAL_DL_MBPS}}': totalDl,
    '{{TOTAL_UL_MBPS}}': totalUl,
    '{{WAN1_GW}}': '192.168.1.1',
    '{{WAN2_GW}}': '192.168.2.1',
    '{{LOCAL_ASN}}': '65000',
    '{{REMOTE_WG_PUBKEY}}': 'xX3aB+9cDeFgHiJkLmNoPqRsTuVwXyZ1234567890=',
    '{{REMOTE_WAN_IP}}': '203.0.113.50',
    '{{PPPOE_WAN_SCRIPTS}}': pppoe.dialer,
    '{{PPPOE_NAT_SCRIPTS}}': pppoe.nat
  };

  const customRaw = document.getElementById('mt-custom-params')?.value || '';
  customRaw.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && trimmed.includes('=')) {
      const eqIdx = trimmed.indexOf('=');
      const k = trimmed.substring(0, eqIdx).trim();
      const v = trimmed.substring(eqIdx + 1).trim();
      if (k) params[`{{${k}}}`] = v;
    }
  });

  return params;
}

function replaceMtParams(str) {
  const params = getMtParams();
  let res = str;
  for (const [k, v] of Object.entries(params)) {
    res = res.split(k).join(v);
  }
  return res;
}

function renderMtCineModules() {
  const container = document.getElementById('mtcine-modules-list');
  if (!container || !MTCINE_DATA.modules) return;
  container.innerHTML = '';

  MTCINE_DATA.modules.forEach(mod => {
    const isSelected = mod.id === activeMtModuleId;
    const btn = document.createElement('button');
    btn.className = `w-full text-left p-3 rounded-xl border transition flex flex-col gap-1 ${isSelected ? 'bg-sky-950/60 border-sky-500/70 text-white shadow-md' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'}`;

    btn.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-bold text-xs ${isSelected ? 'text-sky-300' : 'text-white'}">${escapeHtml(mod.name)}</span>
        <span class="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${isSelected ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400'}">${escapeHtml(mod.category)}</span>
      </div>
      <p class="text-[11px] text-slate-400 leading-snug line-clamp-2">${escapeHtml(mod.desc)}</p>
    `;

    btn.addEventListener('click', () => {
      activeMtModuleId = mod.id;
      renderMtCineModules();
      updateMtCineScript();
    });

    container.appendChild(btn);
  });
}

function updateMtCineScript() {
  const mod = MTCINE_DATA.modules?.find(m => m.id === activeMtModuleId);
  if (!mod) return;

  const titleEl = document.getElementById('mtcine-script-title');
  const descEl = document.getElementById('mtcine-script-desc');
  const outputEl = document.getElementById('mtcine-rsc-output');

  if (titleEl) titleEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-sky-400"></span><span>${escapeHtml(mod.name)}</span>`;
  if (descEl) descEl.textContent = mod.desc;
  if (outputEl) {
    outputEl.textContent = replaceMtParams(mod.rsc);
  }
}

function renderMtCineTroubleshoot() {
  const container = document.getElementById('mtcine-ts-list');
  if (!container || !MTCINE_DATA.troubleshoot) return;
  container.innerHTML = '';

  MTCINE_DATA.troubleshoot.forEach(ts => {
    const card = document.createElement('div');
    card.className = 'bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-1.5 hover:border-slate-700 transition';

    card.innerHTML = `
      <div class="font-bold text-rose-400 flex items-center gap-1.5">
        <span>⚠</span>
        <span>${escapeHtml(ts.problem)}</span>
      </div>
      <div class="text-[11px] text-cyan-300 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800 select-all">
        Lệnh kiểm tra: ${escapeHtml(ts.diagnostic)}
      </div>
      <div class="text-[11px] text-slate-300 leading-relaxed font-sans pt-1">
        💡 <strong>Giải pháp:</strong> ${escapeHtml(ts.solution)}
      </div>
    `;

    container.appendChild(card);
  });
}


// ==========================================
// DARK / LIGHT THEME TOGGLE & CHECK FOR UPDATE
// ==========================================
function applyTheme(theme) {
  const root = document.documentElement;
  const sunIcon = document.getElementById('icon-theme-sun');
  const moonIcon = document.getElementById('icon-theme-moon');

  if (theme === 'light') {
    root.classList.add('light-theme');
    root.classList.remove('dark');
    if (sunIcon) sunIcon.classList.add('hidden');
    if (moonIcon) moonIcon.classList.remove('hidden');
  } else {
    root.classList.remove('light-theme');
    root.classList.add('dark');
    if (sunIcon) sunIcon.classList.remove('hidden');
    if (moonIcon) moonIcon.classList.add('hidden');
  }
  try {
    localStorage.setItem('tracedeck_theme', theme);
  } catch (e) {}
}

function initThemeAndUpdate() {
  let savedTheme = 'dark';
  try {
    savedTheme = localStorage.getItem('tracedeck_theme') || 'dark';
  } catch (e) {}
  applyTheme(savedTheme);

  document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
    const isLight = document.documentElement.classList.contains('light-theme');
    const nextTheme = isLight ? 'dark' : 'light';
    applyTheme(nextTheme);
    showToast(nextTheme === 'light' ? '☀️ Đã chuyển sang Giao diện Sáng (Light Mode)' : '🌙 Đã chuyển sang Giao diện Tối (Dark Mode)');
  });

  // Check for Update handler
  document.getElementById('btn-check-update')?.addEventListener('click', async () => {
    const box = document.getElementById('update-status-box');
    if (box) {
      box.innerHTML = '<span class="text-cyan-400">⏳ Đang kiểm tra phiên bản mới nhất...</span>';
    }
    const res = await safeFetchJson('/api/system/check-update', {
      currentVersion: '2.6.0',
      latestVersion: '2.6.0',
      hasUpdate: false,
      buildDate: '2026-11-12',
      updateCommand: 'cd /var/www/netcli && git pull && pm2 restart netcli',
      changelog: ['v2.6.0: TraceDeck Raycast UI, Dynamic Island Navbar, Dark/Light Toggle & Bản quyền KhangIT.']
    });
    const info = res.data;
    if (box) {
      const statusBadge = info.hasUpdate
        ? `<span class="text-amber-400 font-bold">🔔 Đã có bản mới v${escapeHtml(info.latestVersion)}!</span>`
        : `<span class="text-emerald-400 font-bold">✓ Bạn đang dùng phiên bản mới nhất (v${escapeHtml(info.currentVersion)})</span>`;
      const logsHtml = (info.changelog || []).map(c => `<li class="text-[11px] text-slate-300">• ${escapeHtml(c)}</li>`).join('');
      box.innerHTML = `
        <div class="space-y-2">
          <div>${statusBadge} <span class="text-slate-500 text-[10px]">(Build: ${escapeHtml(info.buildDate)})</span></div>
          <ul class="space-y-1 pt-1">${logsHtml}</ul>
          <div class="pt-2 border-t border-slate-800">
            <div class="text-[10px] text-slate-400 mb-1">Lệnh cập nhật nhanh trên Ubuntu Server:</div>
            <div class="flex items-center justify-between gap-2 bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800">
              <code class="font-mono text-[11px] text-emerald-400 select-all">${escapeHtml(info.updateCommand)}</code>
              <button type="button" class="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white" onclick="copyText('${escapeAttr(info.updateCommand)}', this)">Copy</button>
            </div>
          </div>
        </div>
      `;
    }
    showToast('Đã kiểm tra phiên bản hệ thống!');
  });
}

// ==========================================
// RAYCAST COMMAND PALETTE CONTROLLER (⌘K / Ctrl+K)
// ==========================================
function initRaycastPalette() {
  const modal = document.getElementById('modal-raycast-cmdk');
  const input = document.getElementById('raycast-cmdk-input');
  const resultsBox = document.getElementById('raycast-cmdk-results');
  const triggerBtn = document.getElementById('btn-raycast-cmdk');
  if (!modal || !input || !resultsBox) return;

  let selectedIndex = 0;
  let currentItems = [];

  const BASE_COMMANDS = [
    { type: 'View', icon: '📘', title: 'Cẩm Nang Cấu Hình Đa Hãng (10 Hãng)', sub: 'VIEW-01 • Tra cứu & lọc tác vụ Cisco, CBS, Juniper, FortiGate, Huawei, DrayTek...', action: () => document.getElementById('nav-btn-generator')?.click() },
    { type: 'View', icon: '⚡', title: 'Sinh Lệnh Nhanh & Giả Lập Console', sub: 'VIEW-02 • Checklist chọn tính năng và chạy thử Sandbox', action: () => document.getElementById('nav-btn-builder')?.click() },
    { type: 'View', icon: '🩺', title: 'Chẩn Đoán Sự Cố & AI Optimizer', sub: 'VIEW-04 • Scan log qua SSH/Telnet và xuất lệnh sửa lỗi', action: () => document.getElementById('nav-btn-diagnose')?.click() },
    { type: 'View', icon: '🛰️', title: 'MikroTik RouterOS Chuyên Sâu (v7/v6)', sub: 'VIEW-05 • Recursive Failover, PCC Multi-WAN, BGP v7, MPLS', action: () => document.getElementById('nav-btn-mikrotik')?.click() },
    { type: 'View', icon: '👁️', title: 'Bách Khoa Lệnh Show & Kiểm Tra', sub: 'VIEW-03 • 37+ lệnh show/display và mẹo đọc output', action: () => document.getElementById('nav-btn-showcmds')?.click() },
    { type: 'View', icon: '🧮', title: 'Máy Tính Subnet / Wildcard Mask', sub: 'VIEW-06 • Tính nhanh Network ID, Broadcast, OSPF Wildcard', action: () => document.getElementById('nav-btn-subnet')?.click() },
    { type: 'Tool', icon: '🔌', title: 'Thông Số Console Serial & Baudrate', sub: 'VIEW-07 • 9600 vs 115200 bps, chân cáp, user mặc định', action: () => document.getElementById('nav-btn-console')?.click() },
    { type: 'Tool', icon: '💡', title: 'Cáp Quang & Mở Khóa SFP Bên Thứ 3', sub: 'VIEW-08 • Ngưỡng công suất thu Rx dBm & Unlock OEM SFP', action: () => document.getElementById('nav-btn-fiber')?.click() },
    { type: 'Tool', icon: '📋', title: 'Danh Bạ Port Mạng (TCP/UDP)', sub: 'VIEW-09 • 22+ cổng dịch vụ phổ biến cho ACL & Firewall', action: () => document.getElementById('nav-btn-ports')?.click() },
    { type: 'Tool', icon: '🔑', title: 'Sổ Tay Phá Mật Khẩu (Password Recovery)', sub: 'VIEW-10 • Hướng dẫn từng bước cho người mới nhận bàn giao', action: () => document.getElementById('nav-btn-recovery')?.click() },
    { type: 'Info', icon: '👤', title: 'Giới Thiệu KhangIT & Check for Update', sub: 'VIEW-12 • Bản quyền, câu chuyện ra đời & kiểm tra cập nhật', action: () => document.getElementById('nav-btn-about')?.click() },
    { type: 'Admin', icon: '🔒', title: 'Trang Quản Trị Hệ Thống (Admin Portal)', sub: 'VIEW-11 • RAM/CPU Monitor, CRUD & Golden Backup', action: () => document.getElementById('nav-btn-admin')?.click() },
    { type: 'Action', icon: '📊', title: 'Mở Bảng Đối Chiếu Cú Pháp (Rosetta Stone)', sub: 'So sánh lệnh tương đương giữa các hãng', action: () => document.getElementById('btn-rosetta')?.click() },
    { type: 'Theme', icon: '☀️', title: 'Chuyển Giao Diện Sáng (Light Mode)', sub: 'Bật giao diện sáng Raycast Frosted Light', action: () => { applyTheme('light'); showToast('☀️ Đã bật Giao diện Sáng'); } },
    { type: 'Theme', icon: '🌙', title: 'Chuyển Giao Diện Tối (Dark Mode)', sub: 'Bật giao diện tối Raycast Obsidian', action: () => { applyTheme('dark'); showToast('🌙 Đã bật Giao diện Tối'); } }
  ];

  function openPalette() {
    modal.classList.remove('hidden');
    input.value = '';
    selectedIndex = 0;
    renderPaletteItems('');
    setTimeout(() => input.focus(), 40);
  }

  function closePalette() {
    modal.classList.add('hidden');
  }

  function renderPaletteItems(query) {
    const q = query.toLowerCase().trim();
    const taskItems = (CORE_TASKS || []).slice(0, 15).map(t => ({
      type: 'CLI',
      icon: '⌨️',
      title: t.title,
      sub: t.desc,
      action: () => {
        document.getElementById('nav-btn-generator')?.click();
        const searchInp = document.getElementById('search-input');
        if (searchInp) {
          searchInp.value = t.title.split(' ')[0];
          searchQuery = searchInp.value.toLowerCase();
          renderCards();
        }
      }
    }));

    const all = [...BASE_COMMANDS, ...taskItems];
    currentItems = q ? all.filter(it => it.title.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q) || it.type.toLowerCase().includes(q)) : BASE_COMMANDS;
    if (selectedIndex >= currentItems.length) selectedIndex = 0;

    if (currentItems.length === 0) {
      resultsBox.innerHTML = '<div class="py-8 text-center text-zinc-500 text-xs">Không tìm thấy lệnh hoặc phân hệ phù hợp...</div>';
      return;
    }

    resultsBox.innerHTML = currentItems.map((it, idx) => {
      const activeCls = idx === selectedIndex ? 'bg-rose-500/20 border-rose-500/40 text-white' : 'border-transparent text-zinc-300 hover:bg-white/5';
      return `
        <button type="button" class="cmdk-item w-full text-left px-3 py-2.5 rounded-xl border ${activeCls} flex items-center justify-between gap-3 transition" data-idx="${idx}">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-sm">${it.icon}</span>
            <div class="min-w-0">
              <div class="font-semibold text-xs text-white truncate">${escapeHtml(it.title)}</div>
              <div class="text-[11px] text-zinc-400 truncate">${escapeHtml(it.sub)}</div>
            </div>
          </div>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/10 shrink-0">${escapeHtml(it.type)}</span>
        </button>
      `;
    }).join('');

    resultsBox.querySelectorAll('.cmdk-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (currentItems[idx]) {
          closePalette();
          currentItems[idx].action();
        }
      });
    });
  }

  triggerBtn?.addEventListener('click', openPalette);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closePalette();
  });

  input.addEventListener('input', (e) => {
    selectedIndex = 0;
    renderPaletteItems(e.target.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentItems.length) {
        selectedIndex = (selectedIndex + 1) % currentItems.length;
        renderPaletteItems(input.value);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentItems.length) {
        selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
        renderPaletteItems(input.value);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentItems[selectedIndex]) {
        closePalette();
        currentItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      closePalette();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (modal.classList.contains('hidden')) openPalette();
      else closePalette();
    } else if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closePalette();
    }
  });
}
