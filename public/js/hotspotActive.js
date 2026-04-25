/**
 * hotspotActive.js — Active Hotspot Sessions Management
 * Handles fetching, searching, and disconnecting active users using a Premium Card layout.
 */

window.HotspotActive = {
    init() {
        if (this.isInitialized) return;
        this.cacheDOM();
        this.bindEvents();
        this.data = [];
        this.isInitialized = true;
        console.log('HotspotActive: Initialized.');
    },

    cacheDOM() {
        this.$ = id => document.getElementById(id);
        this.cardsGrid = this.$('activeCardsGrid');
        this.loadingEl = this.$('activeLoading');
        this.emptyEl = this.$('activeEmpty');
        this.searchField = this.$('activeSearch');
        this.refreshBtn = this.$('refreshActiveBtn');
        this.countBadge = this.$('activeCountBadge');
        this.countDisplay = this.$('activeCountDisplay');
    },

    bindEvents() {
        if (this.refreshBtn) {
            this.refreshBtn.addEventListener('click', () => this.fetchActive(true));
        }
        if (this.searchField) {
            this.searchField.addEventListener('input', () => this.render());
        }
    },

    async fetchActive(isManual = false) {
        this.init(); // Ensure initialized
        if (!this.cardsGrid) return;
        
        this.showLoading(true);
        try {
            const res = await API.getHotspotActive();
            this.data = res.active || [];
            
            // Update counts
            const total = this.data.length;
            if (this.countBadge) this.countBadge.textContent = total;
            if (this.countDisplay) this.countDisplay.textContent = total;
            
            this.render();
            if (isManual) window.Dashboard?.showToast('تم تحديث قائمة النشطين', 'success');
        } catch (err) {
            console.error('HotspotActive Error:', err);
            if (isManual) window.Dashboard?.showToast('فشل في جلب البيانات', 'error');
            this.cardsGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:var(--red); background:rgba(239,68,68,0.05); border-radius:20px; border:1px solid rgba(239,68,68,0.1);">فشل الاتصال بالراوتر. يرجى المحاولة لاحقاً.</div>`;
            this.cardsGrid.style.display = 'grid';
        } finally {
            this.showLoading(false);
        }
    },

    showLoading(show) {
        if (this.loadingEl) this.loadingEl.style.display = show ? 'block' : 'none';
        if (this.cardsGrid) {
            this.cardsGrid.style.display = show ? 'none' : 'grid';
        }
    },

    render() {
        if (!this.cardsGrid) return;

        try {
            const query = (this.searchField?.value || '').toLowerCase();
            const filtered = this.data.filter(u => {
                const userName = (u.user || '').toLowerCase();
                const userIp = (u.address || '').toLowerCase();
                const userMac = (u.macAddress || '').toLowerCase();
                const comment = (u.comment || '').toLowerCase();
                return userName.includes(query) || userIp.includes(query) || userMac.includes(query) || comment.includes(query);
            });

            console.log(`HotspotActive: Rendering ${filtered.length} cards.`);

            // Ensure grid is visible before filling
            this.cardsGrid.style.display = 'grid';

            if (filtered.length === 0) {
                this.cardsGrid.innerHTML = '';
                if (this.emptyEl) this.emptyEl.style.display = 'block';
                return;
            }

            if (this.emptyEl) this.emptyEl.style.display = 'none';

            this.cardsGrid.innerHTML = filtered.map(u => {
                const initials = (u.user || '??').substring(0, 2).toUpperCase();
                
                return `
                <div class="active-user-card">
                    <div class="auc-header">
                        <div class="auc-avatar">${initials}</div>
                        <div class="auc-title">
                            <div class="auc-username" title="${u.user}">${u.user || 'غير معروف'}</div>
                            <div class="auc-subtitle">${u.comment || 'لا توجد ملاحظات'}</div>
                        </div>
                        <button class="auc-kick-btn" onclick="HotspotActive.removeSession('${u.id}', '${u.user}')" title="قطع الاتصال">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
                            </svg>
                        </button>
                    </div>

                    <div class="auc-details">
                        <div class="auc-item">
                            <span class="auc-label">العنوان IP</span>
                            <span class="auc-value" style="color:var(--cyan);">${u.address}</span>
                        </div>
                        <div class="auc-item">
                            <span class="auc-label">الماك أدرس</span>
                            <span class="auc-value" style="font-size:0.7rem; opacity:0.8;">${u.macAddress}</span>
                        </div>
                        <div class="auc-item">
                            <span class="auc-label">نشط منذ</span>
                            <span class="auc-value" style="color:var(--green);">${u.uptime}</span>
                        </div>
                        <div class="auc-item">
                            <span class="auc-label">المتبقي</span>
                            <span class="auc-value" style="color:var(--orange);">${u.sessionTimeLeft}</span>
                        </div>
                    </div>

                    <div class="auc-usage">
                        <div class="auc-usage-row">
                            <span style="color:var(--text-muted);">سعة التحميل المتاحة</span>
                            <span style="color:white; font-weight:600;">${u.limitBytesTotal}</span>
                        </div>
                        <div class="auc-progress-bg">
                            <div class="auc-progress-fill" style="width: 100%"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted); margin-top:2px;">
                            <span>⬇️ ${u.limitBytesIn}</span>
                            <span>⬆️ ${u.limitBytesOut}</span>
                        </div>
                    </div>

                    <div class="auc-footer">
                        <span class="auc-status-tag">${u.loginBy}</span>
                        <span style="font-size:0.75rem; color:var(--text-muted); opacity:0.6;">Server: ${u.server}</span>
                    </div>
                </div>
                `;
            }).join('');
        } catch (err) {
            console.error('HotspotActive Render Error:', err);
            if (this.cardsGrid) {
                this.cardsGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:var(--red);">حدث خطأ أثناء عرض البطاقات.</div>`;
                this.cardsGrid.style.display = 'grid';
            }
        }
    },

    async removeSession(id, username) {
        if (!confirm(`هل أنت متأكد من قطع اتصال المستخدم "${username}"؟`)) return;

        try {
            await API.removeHotspotActive(id);
            window.Dashboard?.showToast(`تم قطع اتصال ${username} بنجاح`, 'success');
            await this.fetchActive();
        } catch (err) {
            console.error('Remove Session Error:', err);
            window.Dashboard?.showToast('فشل في قطع الاتصال', 'error');
        }
    }
};

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => HotspotActive.init());
} else {
    HotspotActive.init();
}
