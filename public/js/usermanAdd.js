/**
 * usermanAdd.js
 * Handles the "Add User Manager User" section logic, tabs, and API calls.
 * Advanced features: Bulk Import, Random Generation, Detailed Results, and Progress Overlay.
 * UTF-8 FIXED.
 */

window.UsermanAdd = {
    init() {
        if (this.isInitialized) return;
        console.log('UsermanAdd: Initializing...');
        this.cacheDOM();
        this.bindEvents();
        this.isLoaded = false;
        this.isInitialized = true;
        this.results = { success: [], fail: [] };
        console.log('UsermanAdd: Initialized.');
    },

    cacheDOM() {
        this.$ = id => document.getElementById(id);
        this.section = this.$('userman-add');
        this.form = this.$('formAddUserman');

        // Selects
        this.profileSelect = this.$('umProfileSelect');
        this.customerSelect = this.$('umCustomerSelect');
        this.locationSelect = this.$('umLocationSelect');

        // Buttons
        this.btnGoToAdd = this.$('btnGoToAddUserman');
        this.btnCancel = this.$('btnCancelUserman');
        this.btnSubmit = this.$('btnSubmitUserman');

        // Tabs
        this.tabs = document.querySelectorAll('.u-tab');
        this.tabContents = document.querySelectorAll('.u-tab-content');
        this.currentTab = 'single';

        // Result Modal elements
        this.modal = this.$('umResultsModal');
        this.resListContainer = this.$('resListContainer');
        this.resSearch = this.$('resSearch');
        this.resTabs = document.querySelectorAll('.res-tab');
        this.currentResTab = 'success';

        // Progress Overlay elements
        this.overlay = this.$('umProcessingOverlay');
        this.progCircle = this.$('umProgressCircle');
        this.progPercent = this.$('umProgressPercent');
        this.progSuccess = this.$('umProcessSuccess');
        this.progFail = this.$('umProcessFail');
        this.progTarget = this.$('umCurrentTarget');

        // Advanced Stats Elements
        this.statTotal = this.$('statTotal');
        this.statUnique = this.$('statUnique');
        this.statDupes = this.$('statDupes');
        this.statLengthRange = this.$('statLengthRange');
        this.statAlert = this.$('statAlert');
        this.lenDistribution = this.$('lenDistribution');
        this.statsEmpty = this.$('bulkStatsEmpty');
        this.statsGrid = this.$('bulkStatsArea');
        this.statsVisual = this.$('bulkStatsVisual');
        this.bulkLineCount = this.$('bulkLineCount');

        console.log('UsermanAdd: DOM Cached.');
    },

    bindEvents() {
        // Navigation
        if (this.btnGoToAdd) this.btnGoToAdd.onclick = () => this.showSection();
        if (this.btnCancel) this.btnCancel.onclick = () => this.hideSection();

        // Form Submit
        if (this.form) {
            this.form.onsubmit = async (e) => {
                e.preventDefault();
                await this.submitForm();
            };
        }

        // Direct button click
        if (this.btnSubmit) {
            this.btnSubmit.onclick = async (e) => {
                if (this.form && !this.form.checkValidity()) {
                    this.form.reportValidity();
                    return;
                }
                e.preventDefault();
                await this.submitForm();
            };
        }

        // Tabs Toggle
        this.tabs.forEach(tab => {
            tab.onclick = () => this.switchTab(tab.getAttribute('data-tab'));
        });

        // Bulk Textarea Stats
        const bulkTextarea = this.$('umBulkNames');
        if (bulkTextarea) {
            bulkTextarea.addEventListener('input', () => this.updateAdvancedStats());
        }

        // Prefix / Suffix should also refresh stats because they affect the effective length
        const randPrefix = this.$('umRandPrefix');
        const randSuffix = this.$('umRandSuffix');
        if (randPrefix) {
            randPrefix.addEventListener('input', () => this.updateAdvancedStats());
            randPrefix.addEventListener('change', () => this.updateAdvancedStats());
        }
        if (randSuffix) {
            randSuffix.addEventListener('input', () => this.updateAdvancedStats());
            randSuffix.addEventListener('change', () => this.updateAdvancedStats());
        }

        // File Upload
        const bulkActionBtn = document.getElementById('btnUploadFile');
        const filePicker = document.getElementById('umFilePicker');
        if (bulkActionBtn && filePicker) {
            bulkActionBtn.addEventListener('click', () => {
                console.log('UsermanAdd: File upload clicked');
                filePicker.click();
            });
            filePicker.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // Add a click listener to the entire radio card area to be safe
        document.querySelectorAll('.radio-card-content').forEach(label => {
            label.addEventListener('click', (e) => {
                const radioId = label.getAttribute('for');
                const radio = document.getElementById(radioId);
                if (radio) {
                    radio.checked = true;
                    // Trigger any update if needed
                }
            });
        });

        // Modal Events
        if (this.$('closeResultsModal')) this.$('closeResultsModal').onclick = () => this.closeResultsModal();
        if (this.$('btnFinishResults')) this.$('btnFinishResults').onclick = () => this.closeResultsModal();
        if (this.$('btnCopyResults')) this.$('btnCopyResults').onclick = () => this.copyResultsToClipboard();
        if (this.resSearch) this.resSearch.oninput = () => this.renderResults();

        this.resTabs.forEach(tab => {
            tab.onclick = () => {
                this.currentResTab = tab.getAttribute('data-res');
                this.resTabs.forEach(t => t.classList.toggle('active', t === tab));
                this.renderResults();
            };
        });
    },

    switchTab(targetTab) {
        this.currentTab = targetTab;
        this.tabs.forEach(t => {
            const isActive = t.getAttribute('data-tab') === targetTab;
            t.classList.toggle('active', isActive);
            t.style.background = isActive ? 'rgba(124, 58, 237, 0.15)' : 'transparent';
            t.style.color = isActive ? 'var(--purple)' : 'var(--text-muted)';
            t.style.borderColor = isActive ? 'var(--purple)' : 'rgba(255,255,255,0.1)';
        });

        this.tabContents.forEach(content => {
            content.style.display = content.id === `tab-${targetTab}` ? 'block' : 'none';
        });

        // Feature: Auto-add today's date to First Name in Bulk tab
        if (targetTab === 'bulk') {
            const firstNameInput = document.getElementById('umFirstName');
            if (firstNameInput && !firstNameInput.value) {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                firstNameInput.value = `${yyyy}-${mm}-${dd}`;
            }
        }

        // Open printing tab data if switched to printing
        if (targetTab === 'printing' && window.PrintingTab) {
            window.PrintingTab.open();
        }

        const commonFields = document.getElementById('umCommonFields');
        if (commonFields) {
            commonFields.style.display = targetTab === 'printing' ? 'none' : 'block';
        }

        if (this.btnSubmit) {
            const texts = {
                single: 'إضافة المستخدم والبدء',
                bulk: 'استيراد القائمة والبدء',
                random: 'توليد البطاقات والبدء',
                printing: ''
            };
            if (targetTab === 'printing') {
                this.btnSubmit.style.display = 'none';
                if (this.btnCancel) this.btnCancel.style.display = 'none';
                
                // Hide common field container
                if (commonFields) commonFields.style.display = 'none';
                
                // Hide any footer/action containers
                const footer = document.querySelector('.modal-footer') || document.querySelector('.form-actions');
                if (footer) footer.style.display = 'none';
            } else {
                this.btnSubmit.style.display = '';
                if (this.btnCancel) this.btnCancel.style.display = '';
                
                if (commonFields) commonFields.style.display = 'block';
                
                const footer = document.querySelector('.modal-footer') || document.querySelector('.form-actions');
                if (footer) footer.style.display = 'flex';
                
                this.btnSubmit.innerHTML = texts[targetTab] || 'إرسال';
                this.btnSubmit.disabled = false;
            }
        }
    },

    showSection() {
        if (!this.isLoaded) this.loadInitialData();
        if (this.section) this.section.classList.add('active');
        if (window.UserManager && window.UserManager.section) window.UserManager.section.classList.remove('active');
    },

    hideSection() {
        if (this.section) this.section.classList.remove('active');
        if (window.UserManager && window.UserManager.section) window.UserManager.section.classList.add('active');
    },

    async loadInitialData() {
        if (this.profileSelect) this.profileSelect.innerHTML = '<option value="">جاري جلب الباقات...</option>';
        try {
            // Profiles endpoint returns { success: true, profiles: [{name, id}] }
            const profilesRes = await API.getUserManagerProfiles();
            const profiles = profilesRes.profiles || profilesRes || [];
            if (this.profileSelect) {
                this.profileSelect.innerHTML = '<option value="">-- اختر باقة --</option>' +
                    profiles.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
            }

            // Customers endpoint returns [{login, id}] directly
            const customersRaw = await API.getUserManagerCustomers();
            // Handle both array and {customers:[]} shapes
            const customers = Array.isArray(customersRaw)
                ? customersRaw
                : (customersRaw.customers || []);
            if (this.customerSelect) {
                this.customerSelect.innerHTML = customers.map(c =>
                    `<option value="${c.login || c}" ${(c.login || c) === 'admin' ? 'selected' : ''}>${c.login || c}</option>`
                ).join('');
                if (!this.customerSelect.innerHTML) {
                    this.customerSelect.innerHTML = '<option value="admin" selected>admin</option>';
                }
            }

            if (window.UserManager && window.UserManager.posMap && this.locationSelect) {
                const posEntries = Object.entries(window.UserManager.posMap);
                this.locationSelect.innerHTML = '<option value="">نقطة افتراضية</option>' +
                    posEntries.map(([loc, name]) => `<option value="${loc}">${name} (${loc})</option>`).join('');
            }
            this.isLoaded = true;
        } catch (err) {
            this.showToast('فشل جلب البيانات', 'error');
        }
    },

    getEffectiveLength(name) {
        if (typeof name !== 'string') return 0;

        const prefix = (this.$('umRandPrefix')?.value || '');
        const suffix = (this.$('umRandSuffix')?.value || '');

        let core = name;

        if (prefix && core.startsWith(prefix)) {
            core = core.slice(prefix.length);
        }

        if (suffix && core.endsWith(suffix)) {
            core = core.slice(0, core.length - suffix.length);
        }

        return Math.max(0, core.length);
    },

    updateAdvancedStats() {
        const bulkEl = this.$('umBulkNames');
        const text = bulkEl ? bulkEl.value : '';
        const lines = text.split('\n');
        const names = lines.map(n => n.trim()).filter(n => n !== "");

        if (this.bulkLineCount) this.bulkLineCount.textContent = `${lines.length} أسطر`;

        if (names.length === 0) {
            if (this.statsEmpty) this.statsEmpty.style.display = 'block';
            if (this.statsGrid) this.statsGrid.style.display = 'none';
            if (this.statsVisual) this.statsVisual.style.display = 'none';
            if (this.statLengthRange) this.statLengthRange.textContent = '0';
            return;
        }

        if (this.statsEmpty) this.statsEmpty.style.display = 'none';
        if (this.statsGrid) this.statsGrid.style.display = 'grid';
        if (this.statsVisual) this.statsVisual.style.display = 'block';

        const uniqueNames = [...new Set(names)];

        // IMPORTANT:
        // Length is now calculated after removing Prefix/Suffix from the start/end of each line.
        const effectiveLengths = names.map(n => this.getEffectiveLength(n));

        const minLen = Math.min(...effectiveLengths);
        const maxLen = Math.max(...effectiveLengths);
        const dupeCount = names.length - uniqueNames.length;

        if (this.statTotal) this.statTotal.textContent = names.length;
        if (this.statUnique) this.statUnique.textContent = uniqueNames.length;
        if (this.statDupes) {
            this.statDupes.textContent = dupeCount;
            this.statDupes.style.color = dupeCount > 0 ? 'var(--orange)' : 'var(--green)';
        }
        if (this.statLengthRange) this.statLengthRange.textContent = minLen === maxLen ? `${minLen}` : `${minLen}-${maxLen}`;

        // Alert if inconsistency exists
        if (this.statAlert) this.statAlert.style.display = (maxLen - minLen > 4) ? 'block' : 'none';

        // Distribution Visual
        this.renderLengthDistribution(effectiveLengths);
    },

    renderLengthDistribution(lengths) {
        if (!this.lenDistribution) return;
        if (!lengths || lengths.length === 0) {
            this.lenDistribution.innerHTML = '';
            return;
        }

        const counts = {};
        lengths.forEach(l => counts[l] = (counts[l] || 0) + 1);

        const maxCount = Math.max(...Object.values(counts));
        const sortedLens = Object.keys(counts).sort((a, b) => a - b);

        this.lenDistribution.innerHTML = sortedLens.map(l => {
            const height = (counts[l] / maxCount) * 100;
            return `<div class="len-bar" style="height:${height}%" title="طول ${l}: ${counts[l]} مستخدم"></div>`;
        }).join('');
    },

    handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            this.$('umBulkNames').value = evt.target.result;
            this.updateAdvancedStats();
            this.showToast('تم استيراد الملف بنجاح', 'success');
        };
        reader.readAsText(file);
    },

    async submitForm() {
        try {
            const getVal = (id) => (this.$(id)?.value || "").trim();
            const commonData = {
                profile: getVal('umProfileSelect'),
                customer: getVal('umCustomerSelect'),
                firstName: getVal('umFirstName'),
                lastName: getVal('umLastName'),
                email: getVal('umEmail'),
                phone: getVal('umPhone'),
                location: getVal('umLocationSelect'),
                comment: getVal('umComment')
            };

            if (!commonData.profile) return this.showToast('يرجى اختيار باقة', 'error');

            this.results = { success: [], fail: [] };
            let usersToCreate = [];

            if (this.currentTab === 'single') {
                const username = getVal('umName');
                if (!username) return this.showToast('يرجى إدخال اسم المستخدم', 'error');
                usersToCreate.push({ username, password: getVal('umPass') });
                this.executeSubmit(usersToCreate, commonData);
            } else if (this.currentTab === 'bulk') {
                const names = this.$('umBulkNames').value.split('\n').map(n => n.trim()).filter(n => n !== "");
                if (names.length === 0) return this.showToast('القائمة فارغة', 'error');

                this.askConfirm(`هل أنت متأكد من استيراد ${names.length} مستخدم؟`, () => {
                    const passOption = document.querySelector('input[name="umBulkPassOption"]:checked')?.value || 'empty';
                    usersToCreate = names.map(u => ({
                        username: u,
                        password: this.generatePassword(u, passOption)
                    }));
                    this.executeSubmit(usersToCreate, commonData);
                });
            } else if (this.currentTab === 'random') {
                const count = parseInt(this.$('umRandCount')?.value) || 0;
                this.askConfirm(`هل أنت متأكد من إنشاء ${count} بطاقة عشوائية؟`, () => {
                    usersToCreate = this.generateRandomUsers();
                    this.executeSubmit(usersToCreate, commonData);
                });
            }
        } catch (err) {
            this.showToast('خطأ: ' + err.message, 'error');
            this.hideProgressOverlay();
        }
    },

    askConfirm(msg, onConfirm) {
        const modal = this.$('massConfirmModal');
        const text = this.$('massConfirmText');
        const btnOk = this.$('btnMassConfirm');
        const btnNo = this.$('btnMassCancel');

        if (!modal || !text) return onConfirm(); // Fallback

        text.textContent = msg;
        modal.style.display = 'flex';

        btnOk.onclick = () => {
            modal.style.display = 'none';
            onConfirm();
        };
        btnNo.onclick = () => {
            modal.style.display = 'none';
        };
    },

    async executeSubmit(usersToCreate, commonData) {
        try {
            this.showProgressOverlay(usersToCreate.length);
            const processTitle = this.$('umProcessTitle');
            const processSub = this.$('umProcessSubtitle');

            if (processTitle) processTitle.textContent = 'جاري المعالجة...';
            if (processSub) processSub.textContent = `جاري إنشاء ${usersToCreate.length} مستخدم`;

            for (let i = 0; i < usersToCreate.length; i++) {
                const user = usersToCreate[i];
                this.updateProgress(i + 1, usersToCreate.length, user.username);
                try {
                    await this.createUserWithRetry({ ...commonData, ...user });
                    this.results.success.push({ ...user, status: 'Success' });
                } catch (err) {
                    this.results.fail.push({ ...user, error: err.message, status: 'Failed' });
                }
                this.updateCounters();
            }

            setTimeout(() => {
                this.hideProgressOverlay();
                if (usersToCreate.length === 1 && this.results.success.length === 1) {
                    this.showToast('تم إضافة المستخدم بنجاح', 'success');
                    this.finishSubmit();
                } else {
                    this.openResultsModal();
                }
            }, 500);
        } catch (err) {
            this.showToast('خطأ: ' + err.message, 'error');
            this.hideProgressOverlay();
        }
    },

    showProgressOverlay(total) {
        if (!this.overlay) return;
        this.overlay.style.display = 'flex';
        this.progPercent.textContent = '0%';
        if (this.progCircle) this.progCircle.style.strokeDashoffset = 283;
        this.progSuccess.textContent = '0';
        this.progFail.textContent = '0';
        this.progTarget.textContent = 'جاري البدء...';
    },

    updateProgress(current, total, username) {
        const percent = Math.round((current / total) * 100);
        if (this.progPercent) this.progPercent.textContent = `${percent}%`;
        if (this.progCircle) this.progCircle.style.strokeDashoffset = 283 - (283 * percent / 100);
        if (this.progTarget) this.progTarget.textContent = `جاري إنشاء: ${username}`;
    },

    updateCounters() {
        if (this.progSuccess) this.progSuccess.textContent = this.results.success.length;
        if (this.progFail) this.progFail.textContent = this.results.fail.length;
    },

    hideProgressOverlay() {
        if (this.overlay) this.overlay.style.display = 'none';
    },

    async createUserWithRetry(data, attempt = 1) {
        try {
            await API.addUserManagerUser(data);
        } catch (err) {
            if (this.currentTab === 'random' && attempt < 3 && err.message.includes('already exists')) {
                const newRandom = this.generateRandomUsers(1)[0];
                return this.createUserWithRetry({ ...data, username: newRandom.username, password: newRandom.password }, attempt + 1);
            }
            throw err;
        }
    },

    generatePassword(username, option) {
        if (option === 'same') return username;
        if (option === 'random') return Math.random().toString(36).slice(-6);
        return "";
    },

    generateRandomUsers(countOverride = null) {
        const count = countOverride || parseInt(this.$('umRandCount')?.value) || 10;
        const len = parseInt(this.$('umRandLen')?.value) || 6;
        const prefix = this.$('umRandPrefix')?.value || "";
        const suffix = this.$('umRandSuffix')?.value || "";
        const type = this.$('umRandType')?.value || "numbers";
        const passType = document.querySelector('input[name="umRandPassOption"]:checked')?.value || 'empty';

        const chars = {
            numbers: '0123456789',
            letters: 'abcdefghijklmnopqrstuvwxyz',
            mixed: 'abcdefghijklmnopqrstuvwxyz0123456789'
        }[type];

        const users = [];
        for (let i = 0; i < count; i++) {
            let uname = "";
            for (let j = 0; j < len; j++) uname += chars.charAt(Math.floor(Math.random() * chars.length));
            uname = prefix + uname + suffix;
            users.push({ username: uname, password: this.generatePassword(uname, passType) });
        }
        return users;
    },

    openResultsModal() {
        if (!this.modal) return;
        this.modal.style.display = 'flex';
        this.$('countSuccess').textContent = this.results.success.length;
        this.$('countFail').textContent = this.results.fail.length;
        this.$('resSummary').textContent = `${this.results.success.length} نجاح / ${this.results.fail.length} فشل`;
        this.renderResults();
    },

    renderResults() {
        const query = this.resSearch?.value.toLowerCase() || "";
        const list = this.currentResTab === 'success' ? this.results.success : this.results.fail;
        const filtered = list.filter(u => u.username.toLowerCase().includes(query) || (u.password && u.password.toLowerCase().includes(query)) || (u.error && u.error.toLowerCase().includes(query)));

        if (filtered.length === 0) {
            this.resListContainer.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">لا توجد نتائج مطابقة</div>';
            return;
        }

        this.resListContainer.innerHTML = filtered.map(u => `
            <div class="res-row">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="res-status-icon ${this.currentResTab}">${this.currentResTab === 'success' ? '✓' : '!'}</div>
                    <div>
                        <div style="color:white; font-weight:600; font-family:monospace;">${u.username}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${u.password ? 'P: ' + u.password : 'No Pass'}</div>
                    </div>
                </div>
                ${u.error ? `<div style="color:var(--red); font-size:0.8rem; max-width:200px; text-align:left;">${u.error}</div>` : ''}
                <button onclick="UsermanAdd.copyOne('${u.username}', '${u.password}')" style="background:transparent; border:none; color:var(--purple); cursor:pointer; padding:5px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
            </div>
        `).join('');
    },

    copyOne(u, p) {
        navigator.clipboard.writeText(p ? `${u} / ${p}` : u);
        this.showToast('تم النسخ', 'success');
    },

    copyResultsToClipboard() {
        const list = this.currentResTab === 'success' ? this.results.success : this.results.fail;
        navigator.clipboard.writeText(list.map(u => u.password ? `${u.username},${u.password}` : u.username).join('\n'));
        this.showToast('تم نسخ القائمة بالكامل', 'success');
    },

    closeResultsModal() {
        this.modal.style.display = 'none';
        this.finishSubmit();
    },

    finishSubmit() {
        if (this.form) this.form.reset();
        this.isLoaded = false;
        if (window.UserManager && window.UserManager.fetchUsers) window.UserManager.fetchUsers(true);
        this.updateAdvancedStats();
    },

    showToast(msg, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return alert(msg);
        toast.textContent = msg;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UsermanAdd.init());
} else {
    UsermanAdd.init();
}