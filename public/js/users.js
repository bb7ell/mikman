/**
 * users.js — Hotspot Users Page Logic
 * Handles fetching, filtering, searching and rendering hotspot users
 */

(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────
  let allUsers    = [];
  let activeFilter = 'all';
  let searchQuery  = '';
  let viewMode     = 'cards'; // 'cards' | 'table'

  // ── DOM ──────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  const cardsView    = $('usersCardsView');
  const tableView    = $('usersTableView');
  const tableBody    = $('usersTableBody');
  const searchInput  = $('usersSearch');
  const filterBtns   = document.querySelectorAll('.filter-btn');
  const viewCardBtn  = $('viewCards');
  const viewTableBtn = $('viewTable');
  const navBadge     = $('userCountBadge');

  // Stats
  const statTotal    = $('uTotalCount');
  const statActive   = $('uActiveCount');
  const statDisabled = $('uDisabledCount');
  const statExpired  = $('uExpiredCount');
  const statRevenue  = $('uTotalRevenue');

  // ── Register in navMap (dashboard.js integration) ────────────────
  // Add nav item to dashboard navigation system
  if (window._dashboardNavMap) {
    window._dashboardNavMap['nav-users'] = { section: 'users', title: 'المستخدمون' };
  }

  // ── Fetch ────────────────────────────────────────────────────────
  async function fetchUsers() {
    try {
      const data = await API.getHotspotUsers();
      allUsers = (data.users || []).filter(u => !u.isDefault);
      updateStats();
      renderView();
      if (navBadge) navBadge.textContent = allUsers.length;
    } catch (err) {
      if (err.status === 401) return; // session expired handled elsewhere
      cardsView.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--red)">
        خطأ في تحميل المستخدمين: ${escHtml(err.message)}</div>`;
    }
  }

  // ── Stats ────────────────────────────────────────────────────────
  function updateStats() {
    const active   = allUsers.filter(u => u.status === 'active').length;
    const disabled = allUsers.filter(u => u.status === 'disabled').length;
    const expired  = allUsers.filter(u => u.status === 'expired').length;
    const revenue  = allUsers.reduce((sum, u) => sum + (u.price || 0), 0);

    if (statTotal)    statTotal.textContent    = allUsers.length;
    if (statActive)   statActive.textContent   = active;
    if (statDisabled) statDisabled.textContent = disabled;
    if (statExpired)  statExpired.textContent  = expired;
    if (statRevenue)  statRevenue.textContent  = revenue.toLocaleString('ar-SA') + ' ر.ع';
  }

  // ── Filter & Search ──────────────────────────────────────────────
  function getFilteredUsers() {
    return allUsers.filter(u => {
      const matchStatus = activeFilter === 'all' || u.status === activeFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q ||
        u.name.toLowerCase().includes(q) ||
        u.customerName.toLowerCase().includes(q) ||
        u.profile.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }

  // ── Render ───────────────────────────────────────────────────────
  function renderView() {
    const filtered = getFilteredUsers();
    if (viewMode === 'cards') {
      renderCards(filtered);
    } else {
      renderTable(filtered);
    }
  }

  // ── Cards ────────────────────────────────────────────────────────
  function renderCards(users) {
    if (!cardsView) return;
    if (!users.length) {
      cardsView.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text-muted)">
        لا توجد نتائج مطابقة</div>`;
      return;
    }
    cardsView.innerHTML = users.map(u => buildUserCard(u)).join('');
  }

  function buildUserCard(u) {
    const initials = u.customerName
      ? u.customerName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
      : u.name.substring(0, 2).toUpperCase();

    const statusLabel = { active: 'نشط', disabled: 'معطّل', expired: 'منتهي', inactive: 'غير مستخدم' };
    const usagePct = u.usagePercent || 0;
    const fillClass = usagePct < 50 ? 'low' : usagePct < 80 ? 'medium' : 'high';

    const startDateStr = u.startDate  ? formatDate(u.startDate)  : '--';
    const endDateStr   = u.endDate    ? formatDate(u.endDate)    : '--';
    const daysLeft     = u.daysRemaining;
    const daysHtml     = buildDaysLeftHtml(daysLeft, u.status);
    const priceHtml    = u.price ? `<span class="uc-price">${u.price.toLocaleString('ar-SA')} ر.ع</span>` : '<span class="uc-price" style="color:var(--text-muted)">--</span>';

    return `
    <div class="user-card glass-card status-${u.status}">
      <div class="uc-header">
        <div class="uc-avatar">${escHtml(initials)}</div>
        <div class="uc-title">
          <div class="uc-customer">${escHtml(u.customerName || u.name)}</div>
          <div class="uc-username">${escHtml(u.name)}</div>
        </div>
        <span class="uc-status s-${u.status}">${statusLabel[u.status] || u.status}</span>
      </div>

      <div class="uc-info">
        <div class="uc-info-item">
          <span class="uc-info-label">الباقة</span>
          <span class="uc-info-val">${escHtml(u.profile)}</span>
        </div>
        <div class="uc-info-item">
          <span class="uc-info-label">الصلاحية</span>
          <span class="uc-info-val">${u.validityDays ? u.validityDays + ' يوم' : '--'}</span>
        </div>
        <div class="uc-info-item">
          <span class="uc-info-label">تاريخ البدء</span>
          <span class="uc-info-val">${startDateStr}</span>
        </div>
        <div class="uc-info-item">
          <span class="uc-info-label">تاريخ الانتهاء</span>
          <span class="uc-info-val">${endDateStr}</span>
        </div>
        <div class="uc-info-item">
          <span class="uc-info-label">وقت الاستخدام</span>
          <span class="uc-info-val">${escHtml(u.uptime)}</span>
        </div>
        <div class="uc-info-item">
          <span class="uc-info-label">الحد الأقصى</span>
          <span class="uc-info-val">${escHtml(u.limitBytesStr)}</span>
        </div>
      </div>

      <div class="uc-usage-section">
        <div class="uc-usage-header">
          <span class="uc-usage-label">📥 ${escHtml(u.bytesInStr)} &nbsp;|&nbsp; 📤 ${escHtml(u.bytesOutStr)}</span>
          <span class="uc-usage-pct">${usagePct}%</span>
        </div>
        <div class="uc-progress">
          <div class="uc-progress-fill ${fillClass}" style="width:${usagePct}%"></div>
        </div>
      </div>

      <div class="uc-footer">
        ${priceHtml}
        ${daysHtml}
      </div>
    </div>`;
  }

  // ── Table ────────────────────────────────────────────────────────
  function renderTable(users) {
    if (!tableBody) return;
    if (!users.length) {
      tableBody.innerHTML = '<tr><td colspan="10" class="table-loading">لا توجد نتائج مطابقة</td></tr>';
      return;
    }
    const statusLabel = { active: 'نشط', disabled: 'معطّل', expired: 'منتهي', inactive: 'غير مستخدم' };
    const statusColor = { active: 'var(--green)', disabled: 'var(--red)', expired: 'var(--orange)', inactive: 'var(--text-muted)' };

    tableBody.innerHTML = users.map((u, i) => `
      <tr>
        <td style="color:var(--text-muted)">${i + 1}</td>
        <td><b>${escHtml(u.customerName || '--')}</b></td>
        <td class="mono">${escHtml(u.name)}</td>
        <td>${escHtml(u.profile)}</td>
        <td><span style="color:${statusColor[u.status]};font-weight:600">${statusLabel[u.status] || u.status}</span></td>
        <td class="mono">${u.startDate ? formatDate(u.startDate) : '--'}</td>
        <td class="mono">${u.endDate   ? formatDate(u.endDate)   : '--'}</td>
        <td>${buildDaysChip(u.daysRemaining, u.status)}</td>
        <td class="mono">${escHtml(u.totalUsedStr)} / ${escHtml(u.limitBytesStr)} (${u.usagePercent}%)</td>
        <td class="mono" style="color:var(--yellow)">${u.price ? u.price.toLocaleString('ar-SA') + ' ر.ع' : '--'}</td>
      </tr>`).join('');
  }

  // ── Helpers ──────────────────────────────────────────────────────
  function buildDaysLeftHtml(days, status) {
    if (status === 'disabled') return `<span class="uc-days-left days-none">معطّل</span>`;
    if (days === null)         return `<span class="uc-days-left days-none">--</span>`;
    if (days <= 0)             return `<span class="uc-days-left days-danger">منتهي</span>`;
    if (days <= 3)             return `<span class="uc-days-left days-danger">⚠ ${days} أيام</span>`;
    if (days <= 7)             return `<span class="uc-days-left days-warning">⏳ ${days} أيام</span>`;
    return `<span class="uc-days-left days-ok">✅ ${days} يوم</span>`;
  }

  function buildDaysChip(days, status) {
    if (status === 'disabled') return `<span class="days-chip none">معطّل</span>`;
    if (days === null)         return `<span class="days-chip none">--</span>`;
    if (days <= 0)             return `<span class="days-chip danger">منتهي</span>`;
    if (days <= 3)             return `<span class="days-chip danger">${days} أيام</span>`;
    if (days <= 7)             return `<span class="days-chip warning">${days} أيام</span>`;
    return `<span class="days-chip ok">${days} يوم</span>`;
  }

  function formatDate(isoStr) {
    if (!isoStr) return '--';
    const d = new Date(isoStr);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function escHtml(str) {
    return (str || '').toString()
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Events ───────────────────────────────────────────────────────
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.trim();
      renderView();
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderView();
    });
  });

  if (viewCardBtn) {
    viewCardBtn.addEventListener('click', () => {
      viewMode = 'cards';
      viewCardBtn.classList.add('active');
      viewTableBtn.classList.remove('active');
      cardsView.style.display  = '';
      tableView.style.display  = 'none';
      renderView();
    });
  }

  if (viewTableBtn) {
    viewTableBtn.addEventListener('click', () => {
      viewMode = 'table';
      viewTableBtn.classList.add('active');
      viewCardBtn.classList.remove('active');
      tableView.style.display  = '';
      cardsView.style.display  = 'none';
      renderView();
    });
  }

  // ── Hook into dashboard nav ──────────────────────────────────────
  // Expose refresh so dashboard.js can call it on auto-refresh
  window.refreshUsersPage = fetchUsers;

  // Auto-fetch when users section becomes active
  const usersNavBtn = document.getElementById('nav-users');
  if (usersNavBtn) {
    usersNavBtn.addEventListener('click', () => {
      if (!allUsers.length) fetchUsers();
    });
  }

})();
