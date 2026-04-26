/**
 * dashboard.js — Dashboard Page Logic
 * Handles real-time data fetching from all API endpoints and UI updates
 */

(function () {
  'use strict';

  // ── Config ───────────────────────────────────────────────────────
  let isRefreshing = false;

  // ── DOM References ───────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  // Topbar
  const refreshBtn = $('refreshBtn');
  const uptimeValue = $('uptimeValue');
  const logoutBtn = $('logoutBtn');
  const pageTitle = $('pageTitle');

  // Sidebar info
  const sidebarHost = $('sidebarHost');
  const sidebarUser = $('sidebarUser');
  const connDot = $('connDot');

  // Overview → System info
  const fields = ['boardName', 'version', 'cpu', 'cpuCount', 'cpuFrequency',
    'platform', 'architectureName', 'buildTime'];

  // ── Init ─────────────────────────────────────────────────────────
  async function init() {
    // Verify session
    try {
      const status = await API.getStatus();
      if (!status.connected) { window.location.href = '/'; return; }
      if (status.routerInfo) {
        sidebarHost.textContent = status.routerInfo.host;
        sidebarUser.textContent = status.routerInfo.username;
      }
    } catch {
      window.location.href = '/';
      return;
    }

    setupNavigation();
    setupControls();
    await refreshCurrentSection();
    fetchQuickCounts();
  }

  // ── Navigation ───────────────────────────────────────────────────
  const navMap = {
    'nav-overview': { section: 'overview', title: 'نظرة عامة' },
    'nav-interfaces': { section: 'interfaces', title: 'واجهات الشبكة' },
    'nav-users': { section: 'users', title: 'المستخدمون' },
    'nav-userman': { section: 'userman', title: 'يوزر مانجر' },
    'nav-active-users': { section: 'hotspot-active', title: 'المستخدمون النشطون' },
    'userman-add': { section: 'userman-add', title: 'إضافة مستخدم يوزر مانجر' },
    'nav-templates': { section: 'templates', title: 'قوالب الكروت' },
  };

  function setupNavigation() {
    Object.entries(navMap).forEach(([navId, { section, title }]) => {
      const navEl = $(navId);
      if (!navEl) return;
      navEl.addEventListener('click', (e) => {
        e.preventDefault();
        activateSection(section, title, navId);

        // Close sidebar on mobile
        if (window.innerWidth <= 700) {
          document.getElementById('sidebar').classList.remove('open');
        }
      });
    });

    // Special button on Overview
    const btnGoAddUm = $('btnGoToAddUserman');
    if (btnGoAddUm) {
      btnGoAddUm.onclick = () => {
        activateSection('userman-add', 'إضافة مستخدم يوزر مانجر', null);
      };
    }

    $('sidebarToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
  }

  function activateSection(sectionId, title, activeNavId) {
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    if (activeNavId && $(activeNavId)) $(activeNavId).classList.add('active');
    pageTitle.textContent = title;

    // Additional logic for sections
    if (sectionId === 'userman-add' && window.UsermanAdd) {
      // Only load if not already loaded to prevent flickering
      window.UsermanAdd.showSection();
    } else {
      // Fetch data for the newly activated section
      refreshCurrentSection();
    }
  }

  // ── Controls ─────────────────────────────────────────────────────
  function setupControls() {
    refreshBtn.addEventListener('click', () => {
      if (!isRefreshing) refreshCurrentSection(true);
    });

    logoutBtn.addEventListener('click', async () => {
      await API.logout();
      window.location.href = '/';
    });
  }

  // ── Refresh Current Section ────────────────────────────────────────
  async function refreshCurrentSection(isManual = false) {
    if (isRefreshing) return;

    const activeSection = document.querySelector('.dashboard-section.active');
    if (!activeSection) return;

    const sectionId = activeSection.id;
    isRefreshing = true;
    refreshBtn.classList.add('spinning');

    try {
      // 🚀 PERFORMANCE FIX: Disable background chatter when adding users
      if (sectionId === 'userman-add') {
          isRefreshing = false;
          refreshBtn.classList.remove('spinning');
          return;
      }

      if (isManual || sectionId === 'overview') {
        fetchQuickCounts(); // run in background
      }

      if (sectionId === 'overview') {
        await Promise.allSettled([fetchResources(), fetchHealth()]);
      } else if (sectionId === 'interfaces') {
        await fetchInterfaces();
      } else if (sectionId === 'users') {
        if (typeof window.refreshUsersPage === 'function') await window.refreshUsersPage();
      } else if (sectionId === 'userman') {
        if (window.UserManager) await window.UserManager.fetchUsers(isManual);
      } else if (sectionId === 'hotspot-active') {
        if (window.HotspotActive) await window.HotspotActive.fetchActive(isManual);
      }
    } finally {
      isRefreshing = false;
      refreshBtn.classList.remove('spinning');
    }
  }

  // ── Quick Counts ───────────────────────────────────────────────────
  async function fetchQuickCounts() {
    try {
      const counts = await API.getQuickCounts();
      
      const hsBadge = document.getElementById('userCountBadge');
      if (hsBadge) hsBadge.textContent = counts.users;
      
      const activeBadge = document.getElementById('activeCountBadge');
      if (activeBadge) activeBadge.textContent = counts.active;
      
      const umBadge = document.getElementById('umCountBadge');
      if (umBadge) umBadge.textContent = counts.userman;
      
    } catch (err) {
      console.warn('Failed to fetch quick counts:', err);
    }
  }

  // ── Resources ────────────────────────────────────────────────────
  async function fetchResources() {
    try {
      const r = await API.getResources();

      // System info fields
      const map = {
        boardName: r.boardName, version: r.version, cpu: r.cpu,
        cpuCount: r.cpuCount + ' cores', cpuFrequency: r.cpuFrequency,
        platform: r.platform, architectureName: r.architectureName,
        buildTime: r.buildTime,
      };
      fields.forEach(id => { if ($(id)) $(id).textContent = map[id] || '--'; });

      // Uptime
      uptimeValue.textContent = formatUptime(r.uptime);

      // CPU gauge
      const cpuPct = parseInt(r.cpuLoad) || 0;
      updateGauge(cpuPct);

      // Memory bar
      updateBar('mem', r.memoryPercent, r.freeMemory, r.totalMemory);

      // HDD bar
      updateBar('hdd', r.hddPercent, r.freeHddSpace, r.totalHddSpace);

      // Resources table
      renderResourcesTable(r);

      // Connection OK
      connDot.classList.remove('offline');

    } catch (err) {
      handleFetchError(err, 'الموارد');
    }
  }

  function updateGauge(pct) {
    const circumference = 314;
    const dashoffset = circumference - (circumference * pct / 100);
    const fill = $('cpuGaugeFill');
    const text = $('cpuLoadText');
    if (fill) fill.setAttribute('stroke-dashoffset', dashoffset);
    if (text) text.textContent = pct + '%';

    // Inject SVG gradient if not present
    injectCpuGradient();
  }

  function injectCpuGradient() {
    if (document.getElementById('cpuGrad')) return;
    const svg = document.querySelector('.gauge');
    if (!svg) return;
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <linearGradient id="cpuGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="#00d4ff"/>
        <stop offset="100%" stop-color="#7c3aed"/>
      </linearGradient>`;
    svg.prepend(defs);
  }

  function updateBar(prefix, pct, free, total) {
    const bar = $(prefix + 'BarFill');
    const pctEl = $(prefix + 'Pct');
    const freeEl = $(prefix + 'Free');
    const totalEl = $(prefix + 'Total');
    const usedEl = $(prefix + 'Used');

    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%'; // Removed ' مستخدم'

    // Compute used
    const usedStr = computeUsed(free, total);

    const freeBytes = parseMiB(free);
    const totalBytes = parseMiB(total);

    if (freeEl) freeEl.textContent = freeBytes ? formatMiB(freeBytes) : '--';
    if (totalEl) totalEl.textContent = totalBytes ? formatMiB(totalBytes) : '--';
    if (usedEl) usedEl.textContent = usedStr;
  }

  function computeUsed(freeStr, totalStr) {
    const free = parseMiB(freeStr);
    const total = parseMiB(totalStr);
    if (!total) return '--';
    const used = total - free;
    return formatMiB(used);
  }

  function parseMiB(str) {
    if (!str) return 0;
    const m = str.match(/([\d.]+)\s*(MiB|GiB|KiB|B)?/i);
    if (!m) return 0;
    const v = parseFloat(m[1]);
    const u = (m[2] || 'B').toUpperCase();
    return v * ({ B: 1, KIB: 1024, MIB: 1024 ** 2, GIB: 1024 ** 3 }[u] || 1);
  }

  function formatMiB(bytes) {
    if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + 'GiB';
    if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + 'MiB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + 'KiB';
    return bytes + 'B';
  }

  function renderResourcesTable(r) {
    const tbody = $('resourcesTableBody');
    if (!tbody) return;
    const rows = [
      ['Uptime', r.uptime],
      ['Version', r.version],
      ['Build Time', r.buildTime],
      ['Factory Software', r.factorySoftware],
      ['Free Memory', r.freeMemory],
      ['Total Memory', r.totalMemory],
      ['CPU', r.cpu],
      ['CPU Count', r.cpuCount],
      ['CPU Frequency', r.cpuFrequency],
      ['CPU Load', r.cpuLoad + '%'],
      ['Free HDD Space', r.freeHddSpace],
      ['Total HDD Space', r.totalHddSpace],
      ['Architecture', r.architectureName],
      ['Board Name', r.boardName],
      ['Platform', r.platform],
    ];
    tbody.innerHTML = rows.map(([k, v]) =>
      `<tr><td style="color:var(--text-secondary);font-family:var(--font-main)">${k}</td><td>${v || '--'}</td></tr>`
    ).join('');
  }

  // ── Health ───────────────────────────────────────────────────────
  async function fetchHealth() {
    try {
      const h = await API.getHealth();

      if (h.unsupported) {
        $('healthCardsGrid').innerHTML = '<p style="color:var(--text-muted);padding:16px">بيانات الصحة غير متاحة في هذا الجهاز</p>';
        return;
      }

      // Overview cards  
      setText('voltage', h.voltage);
      setText('current', h.current);
      setText('powerConsumption', h.powerConsumption);
      setText('psu1Voltage', h.psu1Voltage);

      // Temperature gauge
      const tempNum = parseFloat(h.temperature) || 0;
      const tempEl = $('tempValue');
      if (tempEl) tempEl.textContent = h.temperature || '--';
      const tempBar = $('tempBarFill');
      if (tempBar) tempBar.style.width = Math.min(tempNum, 100) + '%';

      // Health section cards
      renderHealthCards(h);

    } catch (err) {
      handleFetchError(err, 'الصحة');
    }
  }

  function renderHealthCards(h) {
    const grid = $('healthCardsGrid');
    if (!grid) return;
    const cards = [
      { icon: '⚡', label: 'الجهد الكهربائي', value: h.voltage },
      { icon: '💡', label: 'استهلاك الطاقة', value: h.powerConsumption },
    ];
    grid.innerHTML = cards.map(c => `
      <div class="health-metric-card">
        <div class="hm-icon">${c.icon}</div>
        <div class="hm-label">${c.label}</div>
        <div class="hm-value">${c.value || '--'}</div>
      </div>`).join('');
  }

  // ── Interfaces ───────────────────────────────────────────────────
  async function fetchInterfaces() {
    try {
      const ifaces = await API.getInterfaces();

      $('ifaceTotalCount').textContent = ifaces.length;
      $('ifaceActiveCount').textContent = ifaces.filter(i => i.running && !i.disabled).length;

      const tbody = $('ifacesTableBody');
      if (!tbody) return;

      if (!ifaces.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-loading">لا توجد واجهات</td></tr>';
        return;
      }

      tbody.innerHTML = ifaces.map(i => {
        const up = i.running && !i.disabled;
        const badge = `<span class="status-badge ${up ? 'up' : 'down'}">${up ? 'متصل' : 'غير متصل'}</span>`;
        return `
          <tr>
            <td><b>${escHtml(i.name)}</b></td>
            <td>${escHtml(i.type)}</td>
            <td>${badge}</td>
            <td>${escHtml(i.macAddress)}</td>
            <td>${formatBytes(i.txByte)}</td>
            <td>${formatBytes(i.rxByte)}</td>
          </tr>`;
      }).join('');

    } catch (err) {
      handleFetchError(err, 'الواجهات');
    }
  }

  // ── Error Handling ───────────────────────────────────────────────
  function handleFetchError(err, section) {
    if (err.status === 401) {
      showToast('انتهت الجلسة — إعادة التوجيه...', 'error');
      connDot.classList.add('offline');
      setTimeout(() => { window.location.href = '/'; }, 2000);
    } else {
      console.warn(`[${section}] fetch error:`, err.message);
    }
  }

  // ── Utilities ────────────────────────────────────────────────────
  function setText(id, val) {
    const el = $(id);
    if (el) el.textContent = val || '--';
  }

  function formatUptime(uptime) {
    if (!uptime || uptime === '--') return '--';
    // "2d8h5m42s" → "2d 8h 5m 42s"
    return uptime.replace(/(\d+[dhms])/g, '$1 ').trim();
  }

  function formatBytes(str) {
    const n = parseInt(str) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + ' MB';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + ' KB';
    return n + ' B';
  }

  function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function showToast(msg, type = '') {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3500);
  }

  // Expose for other scripts
  window.Dashboard = { showToast };

  // ── Boot ─────────────────────────────────────────────────────────
  init();

})();
