/**
 * User Manager Management Module
 * Handles fetching, pagination, and display of User Manager users (30,000+ support)
 */

window.UserManager = {
    currentPage: 1,
    limit: 50,
    searchTerm: '',
    activeFilter: 'all', // 'all' | 'active' | 'disabled'
    viewMode: 'cards',   // 'cards' | 'table'
    isLoading: false,

    async init() {
        this.cacheDOM();
        this.loadPosMap();
        this.bindEvents();
    },

    cacheDOM() {
        this.$ = id => document.getElementById(id);
        
        // Views
        this.cardsView = this.$('umCardsView');
        this.tableView = this.$('umTableView');
        this.tableBody = this.$('umTableBody');
        
        // Stats
        this.statTotal    = this.$('umTotalCount');
        this.statUsed     = this.$('umUsedCount');  // بطاقات تعمل
        this.statNew      = this.$('umNewCount');   // بطاقات جديدة
        this.statDisabled = this.$('umDisabledCount');
        this.statExpired  = this.$('umExpiredCount');
        
        // Toolbar
        this.searchInput  = this.$('umSearchInput');
        this.filterBtns   = document.querySelectorAll('#umToolbar .filter-btn');
        this.viewCardBtn  = this.$('umViewCards');
        this.viewTableBtn = this.$('umViewTable');
        this.managePosBtn = this.$('umManagePos');

        // Modal
        this.posModal = this.$('posModal');
        this.closePosModal = this.$('closePosModal');
        this.addPosBtn = this.$('addPosBtn');
        this.posLocInput = this.$('posLocationInput');
        this.posNameInput = this.$('posNameInput');
        this.posTableBody = this.$('posTableBody');
        
        // Pagination
        this.prevBtn = this.$('umPrevBtn');
        this.nextBtn = this.$('umNextBtn');
        this.currentPageDisplay = this.$('umCurrentPage');
        this.totalPagesDisplay = this.$('umTotalPages');
        this.rangeStartDisplay = this.$('umRangeStart');
        this.rangeEndDisplay = this.$('umRangeEnd');
        this.totalDisplay = this.$('umTotalDisplay');
    },

    bindEvents() {
        // Search
        this.searchInput.oninput = () => {
            this.searchTerm = this.searchInput.value.trim().toLowerCase();
            this.currentPage = 1;
            this.renderFiltered();
        };

        // Filters
        this.filterBtns.forEach(btn => {
            btn.onclick = () => {
                this.filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeFilter = btn.dataset.filter;
                this.currentPage = 1;
                this.renderFiltered();
            };
        });

        // View Toggles
        if (this.viewCardBtn) {
            this.viewCardBtn.onclick = () => {
                this.viewMode = 'cards';
                this.viewCardBtn.classList.add('active');
                this.viewTableBtn.classList.remove('active');
                this.cardsView.style.display = '';
                this.tableView.style.display = 'none';
                this.renderFiltered();
            };
        }
        if (this.viewTableBtn) {
            this.viewTableBtn.onclick = () => {
                this.viewMode = 'table';
                this.viewTableBtn.classList.add('active');
                this.viewCardBtn.classList.remove('active');
                this.tableView.style.display = '';
                this.cardsView.style.display = 'none';
                this.renderFiltered();
            };
        }

        // Modal Events
        if (this.managePosBtn) {
            this.managePosBtn.onclick = () => {
                this.renderPosTable();
                this.posModal.style.display = 'flex';
            };
        }
        if (this.closePosModal) {
            this.closePosModal.onclick = () => this.posModal.style.display = 'none';
        }
        window.onclick = (e) => { if (e.target == this.posModal) this.posModal.style.display = 'none'; };

        if (this.addPosBtn) {
            this.addPosBtn.onclick = () => {
                const loc = this.posLocInput.value.trim();
                const name = this.posNameInput.value.trim();
                if (loc && name) {
                    this.posMap[loc] = name;
                    this.savePosMap();
                    this.renderPosTable();
                    this.posLocInput.value = '';
                    this.posNameInput.value = '';
                    this.renderFiltered(); // Refresh names in main view
                }
            };
        }

        // Pagination
        this.prevBtn.onclick = () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderFiltered();
            }
        };
        this.nextBtn.onclick = () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.renderFiltered();
            }
        };
    },

    loadPosMap() {
        const saved = localStorage.getItem('um_pos_map');
        this.posMap = saved ? JSON.parse(saved) : {};
    },

    savePosMap() {
        localStorage.setItem('um_pos_map', JSON.stringify(this.posMap));
    },

    getPosName(loc) {
        if (!loc || loc === '') return 'نقطة الرئيسية';
        return this.posMap[loc] || `نقطة ${loc}`;
    },

    renderPosTable() {
        this.posTableBody.innerHTML = Object.entries(this.posMap).map(([loc, name]) => `
            <tr>
                <td>${loc}</td>
                <td><b>${this.escHtml(name)}</b></td>
                <td><button class="btn-del" onclick="UserManager.deletePos('${loc}')">إزالة</button></td>
            </tr>
        `).join('');
    },

    deletePos(loc) {
        delete this.posMap[loc];
        this.savePosMap();
        this.renderPosTable();
        this.renderFiltered();
    },

    async fetchUsers(force = false) {
        if (this.isLoading) return;

        // Fetch once unless forced
        if (this.allUsers && !force) {
            this.renderFiltered();
            return;
        }

        this.isLoading = true;
        
        // Show loading
        const loadingHtml = '<div class="table-loading" style="grid-column:1/-1;text-align:center;padding:48px">جارٍ تحميل جميع البيانات (طلب واحد)...</div>';
        this.cardsView.innerHTML = loadingHtml;
        this.tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">جارٍ التحميل...</td></tr>';
        
        try {
            // We fetch a large number (e.g. 50,000)
            const data = await API.getUserManagerUsers(1, 50000, '', 'all'); 
            
            this.allUsers = data.users || [];
            
            this.updateStats(); 
            this.renderFiltered();
        } catch (err) {
            console.error('UM fetch once error:', err);
            const errHtml = `<div class="table-error" style="grid-column:1/-1;text-align:center;padding:48px;color:var(--red)">فشل التحميل: ${err.message}</div>`;
            this.cardsView.innerHTML = errHtml;
            this.tableBody.innerHTML = `<tr><td colspan="7" class="table-error">فشل التحميل: ${err.message}</td></tr>`;
        } finally {
            this.isLoading = false;
        }
    },

    updateStats() {
        if (!this.allUsers) return;

        const total = this.allUsers.length;
        const disabled = this.allUsers.filter(u => u.isDisabled).length;
        
        const isUsed = u => {
            const uptimeVal = parseFloat(u.uptimeUsed) || 0;
            return uptimeVal > 0 || /^[1-9]/.test(u.uptimeUsed);
        };

        const working = this.allUsers.filter(u => !u.isDisabled && (u.actualProfile && u.actualProfile !== '') && isUsed(u)).length;
        const newCards = this.allUsers.filter(u => !u.isDisabled && !isUsed(u)).length;
        const expired = this.allUsers.filter(u => (!u.actualProfile || u.actualProfile === '') && isUsed(u)).length;

        if (this.statTotal)    this.statTotal.textContent    = total.toLocaleString();
        if (this.statUsed)     this.statUsed.textContent     = working.toLocaleString();
        if (this.statNew)      this.statNew.textContent      = newCards.toLocaleString();
        if (this.statDisabled) this.statDisabled.textContent = disabled.toLocaleString();
        if (this.statExpired)  this.statExpired.textContent  = expired.toLocaleString();
    },

    renderFiltered() {
        if (!this.allUsers) return;

        // 1. Client-side Filtering
        const filtered = this.allUsers.filter(u => {
            // Common logic for uptime
            const isUsed = () => {
                const uptimeVal = parseFloat(u.uptimeUsed) || 0;
                return uptimeVal > 0 || /^[1-9]/.test(u.uptimeUsed);
            };

            // Filter by Status
            let matchesFilter = true;
            if (this.activeFilter === 'working') {
                matchesFilter = !u.isDisabled && (u.actualProfile && u.actualProfile !== '') && isUsed();
            } else if (this.activeFilter === 'new') {
                matchesFilter = !u.isDisabled && !isUsed();
            } else if (this.activeFilter === 'disabled') {
                matchesFilter = u.isDisabled;
            } else if (this.activeFilter === 'expired') {
                matchesFilter = (!u.actualProfile || u.actualProfile === '') && isUsed();
            }

            // Filter by Search
            let matchesSearch = true;
            if (this.searchTerm) {
                matchesSearch = (u.username || '').toLowerCase().includes(this.searchTerm) ||
                                (u.comment || '').toLowerCase().includes(this.searchTerm);
            }

            return matchesFilter && matchesSearch;
        });

        // 2. Client-side Pagination Logic
        this.totalPages = Math.ceil(filtered.length / this.limit) || 1;
        if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
        
        const start = (this.currentPage - 1) * this.limit;
        const end = start + this.limit;
        const paginatedUsers = filtered.slice(start, end);

        // 3. Render
        if (this.viewMode === 'cards') {
            this.renderCards(paginatedUsers, filtered.length);
        } else {
            this.renderTable(paginatedUsers, filtered.length);
        }

        // 4. Update Pagination UI
        this.updatePaginationUI(this.currentPage, this.totalPages, filtered.length);
    },

    renderCards(users, totalMatch) {
        if (!users.length) {
            this.cardsView.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text-muted)">لا يوجد نتائج مطابقة</div>';
            return;
        }

        this.cardsView.innerHTML = users.map(u => {
            const uname = u.username || '--';
            const posName = this.getPosName(u.location);
            const initials = posName.substring(0, 2).toUpperCase();
            
            const statusLabel = u.isDisabled ? 'معطّل' : 'نشط';
            const statusClass = u.isDisabled ? 'disabled' : 'active';
            
            const lastSeenDate = this.parseRouterOSDate(u.lastSeen);
            const lastSeenText = u.lastSeen === 'never' ? 'لم يظهر أبداً' : this.timeAgo(lastSeenDate);
            
            return `
            <div class="user-card glass-card status-${statusClass}">
                <div class="uc-header">
                    <div class="uc-avatar">${this.escHtml(initials)}</div>
                    <div class="uc-title">
                        <div class="uc-customer">${this.escHtml(posName)}</div>
                        <div class="uc-username">${this.escHtml(uname)} (العميل: ${u.customer})</div>
                    </div>
                    <span class="uc-status s-${statusClass}">${statusLabel}</span>
                </div>
                
                <div class="uc-info">
                    <div class="uc-info-item">
                        <span class="uc-info-label">الباقة</span>
                        <span class="uc-info-val badge-profile">${this.escHtml(u.profile || 'بدون باقة')}</span>
                    </div>
                    <div class="uc-info-item">
                        <span class="uc-info-label">آخر ظهور</span>
                        <span class="uc-info-val text-highlight">${lastSeenText}</span>
                    </div>
                    <div class="uc-info-item">
                        <span class="uc-info-label">النشاط</span>
                        <span class="uc-info-val mono">${this.formatDuration(u.uptimeUsed)}</span>
                    </div>
                    <div class="uc-info-item">
                        <span class="uc-info-label">التعليق</span>
                        <span class="uc-info-val italic" title="${u.comment}">${this.escHtml(u.comment) || '--'}</span>
                    </div>
                </div>

                <div class="uc-usage-section">
                    <div class="uc-usage-header">
                        <span class="uc-usage-label">📊 إجمالي البيانات: ${u.totalUsed}</span>
                    </div>
                    <div class="uc-progress">
                        <div class="uc-progress-fill medium" style="width:100%"></div>
                    </div>
                </div>

                <div class="uc-footer">
                    <span class="uc-price">${u.password ? '•'.repeat(8) : '<small>بدون كلمة سر</small>'}</span>
                    <span class="uc-days-left days-ok">ID: ${u.id}</span>
                </div>
            </div>`;
        }).join('');
    },

    renderTable(users, totalMatch) {
        if (!users.length) {
            this.tableBody.innerHTML = '<tr><td colspan="7" class="table-empty">لا يوجد نتائج مطابقة</td></tr>';
            return;
        }

        this.tableBody.innerHTML = users.map(u => {
            const uname = u.username || '--';
            const posName = this.getPosName(u.location);
            const lastSeenDate = this.parseRouterOSDate(u.lastSeen);
            const lastSeenText = u.lastSeen === 'never' ? 'لم يظهر أبداً' : this.timeAgo(lastSeenDate);

            return `
            <tr class="${u.isDisabled ? 'row-disabled' : ''}">
                <td>
                    <div class="user-main-info">
                        <span class="user-icon-circle">${posName.toString().substring(0,2)}</span>
                        <div>
                            <div class="user-uname">${uname}</div>
                            <div class="user-pwd">${u.password ? '•'.repeat(8) : '<small>بدون كلمة سر</small>'}</div>
                        </div>
                    </div>
                </td>
                <td><span class="profile-badge">${u.profile || 'بدون باقة'}</span></td>
                <td><span class="customer-name">${this.escHtml(posName)}</span><br><small>${u.customer}</small></td>
                <td>
                    <div class="usage-summary">
                        <small>نشاط: <b>${this.formatDuration(u.uptimeUsed)}</b></small>
                        <small>إجمالي: <b>${u.totalUsed}</b></small>
                    </div>
                </td>
                <td><small class="mono text-highlight">${lastSeenText}</small></td>
                <td>
                    <span class="status-indicator indicator-${u.isDisabled ? 'disabled' : 'active'}">
                       ${u.isDisabled ? 'معطل' : 'نشط'}
                    </span>
                </td>
                <td><div class="user-comment" title="${u.comment || ''}">${u.comment || '--'}</div></td>
            </tr>`;
        }).join('');
    },

    updatePaginationUI(page, totalPages, totalMatched) {
        if (this.totalDisplay) this.totalDisplay.textContent = totalMatched.toLocaleString();
        this.currentPageDisplay.textContent = page;
        this.totalPagesDisplay.textContent = totalPages;
        
        const start = totalMatched === 0 ? 0 : (page - 1) * this.limit + 1;
        const end = Math.min(start + this.limit - 1, totalMatched);
        
        this.rangeStartDisplay.textContent = start;
        this.rangeEndDisplay.textContent = end;

        this.prevBtn.disabled = (page <= 1);
        this.nextBtn.disabled = (page >= totalPages);
    },

    // ── Helpers ──────────────────────────────────────────────────
    
    parseRouterOSDate(str) {
        if (!str || str === 'never') return null;
        const months = {
            jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11
        };
        const parts = str.split(/[/ :]/);
        if (parts.length < 6) return null;
        
        const mon = months[parts[0].toLowerCase()];
        const day = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        const h = parseInt(parts[3]);
        const m = parseInt(parts[4]);
        const s = parseInt(parts[5]);
        
        return new Date(year, mon, day, h, m, s);
    },

    timeAgo(date) {
        if (!date) return 'لم يظهر أبداً';
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'الآن';
        
        let interval = seconds / 31536000;
        if (interval > 1) return 'منذ ' + Math.floor(interval) + ' سنة';
        interval = seconds / 2592000;
        if (interval > 1) return 'منذ ' + Math.floor(interval) + ' شهر';
        interval = seconds / 86400;
        if (interval > 1) return 'منذ ' + Math.floor(interval) + ' يوم';
        interval = seconds / 3600;
        if (interval > 1) return 'منذ ' + Math.floor(interval) + ' ساعة';
        interval = seconds / 60;
        if (interval > 1) return 'منذ ' + Math.floor(interval) + ' دقيقة';
        return 'منذ ثوانٍ';
    },

    formatDuration(dur) {
        if (!dur || dur === '0s') return 'لا يوجد';
        return dur.replace(/(\d+[a-z])/g, '$1 ').trim();
    },

    escHtml(str) {
        return (str || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
};

// Initialize when DOM is available
document.addEventListener('DOMContentLoaded', () => UserManager.init());
