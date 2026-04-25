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

    console.log('✅ Login UI Ready');
});
