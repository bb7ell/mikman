/**
 * hotspotAdd.js — Logic for adding new Hotspot users
 * Handles UI, data conversion, and submission
 */

const HotspotAdd = {
    modal: null,
    
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadProfiles();
        this.loadPos();
    },

    cacheDOM() {
        this.modal = document.getElementById('hotspotModal');
        this.btnOpen = document.getElementById('btnAddHotspot');
        this.btnClose = document.getElementById('closeHotspotModal');
        this.btnCancel = document.getElementById('cancelHotspotBtn');
        this.btnSubmit = document.getElementById('submitHotspotBtn');
        
        // Form fields
        this.fName = document.getElementById('hsName');
        this.fPass = document.getElementById('hsPass');
        this.fProfile = document.getElementById('hsProfile');
        this.fData = document.getElementById('hsData');
        this.fDataUnit = document.getElementById('hsDataUnit');
        this.fValidity = document.getElementById('hsValidity');
        this.fValidityUnit = document.getElementById('hsValidityUnit');
        this.fPrice = document.getElementById('hsPrice');
        this.fNote = document.getElementById('hsNote');
        this.fPos = document.getElementById('hsPos');
    },

    bindEvents() {
        if (this.btnOpen) {
            this.btnOpen.onclick = () => {
                this.modal.style.display = 'flex';
                this.loadProfiles(); // Refresh on open
                this.loadPos();
            };
        }
        
        const close = () => { this.modal.style.display = 'none'; };
        if (this.btnClose) this.btnClose.onclick = close;
        if (this.btnCancel) this.btnCancel.onclick = close;
        
        window.onclick = (e) => { if (e.target == this.modal) close(); };

        if (this.btnSubmit) {
            this.btnSubmit.onclick = () => this.handleSubmit();
        }
    },

    async loadProfiles() {
        try {
            const resp = await fetch('/api/hotspot/profiles');
            const profiles = await resp.json();
            if (this.fProfile) {
                this.fProfile.innerHTML = profiles.map(p => `
                    <option value="${p.name}">${p.name}</option>
                `).join('');
            }
        } catch (err) {
            console.error('Error loading profiles:', err);
        }
    },

    loadPos() {
        // Load from UserManager's local storage map
        const saved = localStorage.getItem('um_pos_map');
        const posMap = saved ? JSON.parse(saved) : {};
        
        if (this.fPos) {
            let options = '<option value="">الرئيسية</option>';
            Object.entries(posMap).forEach(([loc, name]) => {
                options += `<option value="${name}">${name} (${loc})</option>`;
            });
            this.fPos.innerHTML = options;
        }
    },

    async handleSubmit() {
        const name = this.fName.value.trim();
        const password = this.fPass.value.trim();
        const profile = this.fProfile.value;
        const dataVal = parseFloat(this.fData.value) || 0;
        const dataUnit = this.fDataUnit.value;
        const validityVal = parseInt(this.fValidity.value) || 0;
        const validityUnit = this.fValidityUnit.value;
        const price = this.fPrice.value.trim() || '0';
        const note = this.fNote.value.trim();
        const pos = this.fPos.value;

        if (!name) {
            this.showToast('يرجى ادخال اسم المستخدم', 'error');
            return;
        }

        // 1. Data conversion
        let bytes = 0;
        if (dataUnit === 'MB') bytes = dataVal * 1024 * 1024;
        else if (dataUnit === 'GB') bytes = dataVal * 1024 * 1024 * 1024;
        else if (dataUnit === 'TB') bytes = dataVal * 1024 * 1024 * 1024 * 1024;

        // 2. Validity conversion (limit-uptime)
        const limitUptime = validityUnit === 'hours' ? `${validityVal}h` : `${validityVal}d`;

        this.btnSubmit.disabled = true;
        this.btnSubmit.textContent = 'جاري الحفظ...';

        try {
            const resp = await fetch('/api/hotspot/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name, password, profile,
                    limitBytesTotal: Math.floor(bytes),
                    limitUptime,
                    price, note, pos,
                    validityValue: validityVal,
                    validityUnit: validityUnit
                })
            });

            const result = await resp.json();
            if (result.success) {
                this.showToast('تم إضافة المستخدم بنجاح ✨', 'success');
                this.modal.style.display = 'none';
                this.resetForm();
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            this.showToast('فشل إضافة المستخدم: ' + err.message, 'error');
        } finally {
            this.btnSubmit.disabled = false;
            this.btnSubmit.textContent = 'حفظ المستخدم';
        }
    },

    resetForm() {
        this.fName.value = '';
        this.fPass.value = '';
        this.fData.value = '';
        this.fValidity.value = '';
        this.fPrice.value = '';
        this.fNote.value = '';
    },

    showToast(msg, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) {
           alert(msg);
           return;
        }
        toast.textContent = msg;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => HotspotAdd.init());
