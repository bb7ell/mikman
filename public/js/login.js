/**
 * login.js — Simplified Login Page Logic
 */

console.log('📡 Script login.js started loading...');

// Define global function first
window.handleLoginRequest = async function() {
    console.log('🚀 handleLoginRequest calling...');
    const errorMsg = document.getElementById('errorMsg');
    const errorText = document.getElementById('errorText');
    const loginBtn = document.getElementById('loginBtn');
    
    const host = document.getElementById('host').value.trim();
    const port = document.getElementById('port').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!host || !username) {
        alert('يرجى ملء جميع الحقول المطلوبة (IP واسم المستخدم)');
        return;
    }

    // UI Loading state
    loginBtn.disabled = true;
    loginBtn.querySelector('.btn-text').hidden = true;
    loginBtn.querySelector('.btn-spinner').hidden = false;

    try {
        console.log('📡 Requesting API login...');
        const result = await API.login(host, port, username, password);
        console.log('📦 Server Response:', result);

        if (result.success) {
            window.location.href = '/dashboard';
        } else {
            throw new Error(result.error || 'بيانات الدخول غير صحيحة');
        }
    } catch (err) {
        console.error('❌ Login Error:', err);
        errorText.textContent = err.message || 'فشل الاتصال بالسيرفر';
        errorMsg.hidden = false;
        
        // Reset UI
        loginBtn.disabled = false;
        loginBtn.querySelector('.btn-text').hidden = false;
        loginBtn.querySelector('.btn-spinner').hidden = true;
    }
};

// Handle Password Toggle
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('togglePassword');
    const pwdInput = document.getElementById('password');
    if (toggleBtn && pwdInput) {
        toggleBtn.onclick = () => {
            const isPwd = pwdInput.type === 'password';
            pwdInput.type = isPwd ? 'text' : 'password';
        };
    }

    // Support Enter Key
    document.getElementById('loginForm').onsubmit = (e) => {
        e.preventDefault();
        window.handleLoginRequest();
    };
    // Fetch Saved Routers
    async function loadSavedRouters() {
        try {
            const res = await fetch('/api/auth/saved-routers');
            const data = await res.json();
            
            const grid = document.getElementById('savedRoutersGrid');
            const manualForm = document.getElementById('loginForm');
            const showFormBtn = document.getElementById('showManualFormBtn');
            const manualFormHeader = document.getElementById('manualFormHeader');

            if (data.success && data.routers.length > 0) {
                grid.style.display = 'grid';
                manualForm.style.display = 'none';
                showFormBtn.style.display = 'block';
                manualFormHeader.style.display = 'block';
                
                grid.innerHTML = '';
                
                data.routers.forEach(r => {
                    const card = document.createElement('div');
                    card.className = 'router-card';
                    card.onclick = () => quickLogin(r);
                    
                    card.innerHTML = `
                        <div class="router-info">
                            <div class="router-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="2" y="2" width="20" height="20" rx="3"/><path d="M8 12h8M12 8v8"/>
                                </svg>
                            </div>
                            <div class="router-text">
                                <h4>${r.name || 'راوتر غير مسمى'}</h4>
                                <p>${r.host}:${r.port}</p>
                            </div>
                        </div>
                        <div class="router-actions">
                            <button class="delete-card-btn" onclick="deleteRouter(event, ${r.id})" title="حذف الراوتر">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
                                </svg>
                            </button>
                        </div>
                    `;
                    grid.appendChild(card);
                });
            } else {
                grid.style.display = 'none';
                showFormBtn.style.display = 'none';
                manualForm.style.display = 'flex';
                manualFormHeader.style.display = 'none';
            }
        } catch (e) {
            console.error('Failed to load saved routers', e);
        }
    }

    window.toggleManualForm = function() {
        const manualForm = document.getElementById('loginForm');
        manualForm.style.display = manualForm.style.display === 'none' ? 'flex' : 'none';
    };

    window.deleteRouter = async function(e, id) {
        e.stopPropagation(); // Prevent card click
        if (!confirm('هل أنت متأكد من حذف هذا الراوتر المحفوظ؟')) return;
        
        const delRes = await fetch(`/api/auth/saved-routers/${id}`, { method: 'DELETE' });
        if (delRes.ok) loadSavedRouters();
    };

    async function quickLogin(routerData) {
        const errorMsg = document.getElementById('errorMsg');
        const errorText = document.getElementById('errorText');
        
        try {
            console.log('📡 Requesting API login (Quick Connect)...');
            const result = await API.login(routerData.host, routerData.port, routerData.username, routerData.password);
            
            if (result.success) {
                window.location.href = '/dashboard';
            } else {
                throw new Error(result.error || 'فشل الاتصال بهذا الراوتر');
            }
        } catch (err) {
            alert(err.message || 'فشل الاتصال بالراوتر المحفوظ');
        }
    }
    
    loadSavedRouters();

    // Redefine handleLoginRequest to save router if name is provided
    window.handleLoginRequest = async function() {
        console.log('🚀 handleLoginRequest calling...');
        const errorMsg = document.getElementById('errorMsg');
        const errorText = document.getElementById('errorText');
        const loginBtn = document.getElementById('loginBtn');
        
        const host = document.getElementById('host').value.trim();
        const port = document.getElementById('port').value.trim();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const routerName = document.getElementById('routerName').value.trim();

        if (!host || !username) {
            alert('يرجى ملء جميع الحقول المطلوبة (IP واسم المستخدم)');
            return;
        }

        loginBtn.disabled = true;
        loginBtn.querySelector('.btn-text').hidden = true;
        loginBtn.querySelector('.btn-spinner').hidden = false;

        try {
            // Save Router first if Name is provided
            if (routerName) {
                // Check if it's already saved to avoid duplicates
                const res = await fetch('/api/auth/saved-routers');
                const data = await res.json();
                let isNew = true;
                if (data.success && data.routers) {
                    for(let r of data.routers) {
                        if (r.name === routerName && r.host === host) isNew = false;
                    }
                }
                
                if (isNew) {
                    await fetch('/api/auth/saved-routers', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ name: routerName, host, port, username, password })
                    });
                }
            }

            console.log('📡 Requesting API login...');
            const result = await API.login(host, port, username, password);
            console.log('📦 Server Response:', result);

            if (result.success) {
                window.location.href = '/dashboard';
            } else {
                throw new Error(result.error || 'بيانات الدخول غير صحيحة');
            }
        } catch (err) {
            console.error('❌ Login Error:', err);
            errorText.textContent = err.message || 'فشل الاتصال بالسيرفر';
            errorMsg.hidden = false;
            
            loginBtn.disabled = false;
            loginBtn.querySelector('.btn-text').hidden = false;
            loginBtn.querySelector('.btn-spinner').hidden = true;
        }
    };

    console.log('✅ Login UI Ready');
});
