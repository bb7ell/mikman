const express = require('express');
const router = express.Router();
const mikrotik = require('../mikrotik');
const iconv = require('iconv-lite');

function requireAuth(req, res, next) {
  if (!req.session.connected || !mikrotik.isConnected(req.session.id)) {
    return res.status(401).json({ error: 'Not connected' });
  }
  next();
}

/**
 * 🚀 RADICAL FIX: Advanced decoding to fix Arabic Mojibake from RouterOS
 */
function fixEncoding(str) {
  if (!str || typeof str !== 'string') return '';
  const buf = Buffer.from(str, 'latin1');
  const utf8Str = buf.toString('utf8');
  if (/[\u0600-\u06FF]/.test(utf8Str)) return utf8Str;
  const win1256Str = iconv.decode(buf, 'win1256');
  if (/[\u0600-\u06FF]/.test(win1256Str)) return win1256Str;
  return utf8Str || str;
}

function formatBytes(bytes) {
  const n = parseInt(bytes) || 0;
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' TB';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' MB';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' KB';
  return n + ' B';
}

// ── GET /api/user-manager/users ─────────────────────────────────────────
router.get('/users', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const filter = req.query.filter || 'all';

    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // 1. Get counts (wrap in individual try/catches to avoid total failure)
    let totalUsers = 0, enabledUsers = 0, disabledUsers = 0;
    try {
      const totalRes = await mikrotik.execute(req.session.id, '/tool/user-manager/user/print', { 'count': '' });
      totalUsers = parseInt(totalRes[0] ? totalRes[0].ret : 0) || 0;
    } catch (e) { console.error('Total count fail:', e.message); }

    try {
      const enabledRes = await mikrotik.execute(req.session.id, '/tool/user-manager/user/print', { 'count': '', '?disabled': 'no' });
      enabledUsers = parseInt(enabledRes[0] ? enabledRes[0].ret : 0) || 0;
    } catch (e) { console.error('Enabled count fail:', e.message); }

    try {
      const disabledRes = await mikrotik.execute(req.session.id, '/tool/user-manager/user/print', { 'count': '', '?disabled': 'yes' });
      disabledUsers = parseInt(disabledRes[0] ? disabledRes[0].ret : 0) || 0;
    } catch (e) { console.error('Disabled count fail:', e.message); }

    // Fallback: If status counts are 0 but total is not, we might not have support for filtered counts
    if (totalUsers > 0 && enabledUsers === 0 && disabledUsers === 0) {
      // Just leave them as 0 or -- in UI
    }

    // 2. Build the query params
    const queryParams = {
      '.range': `${start}-${end}`,
      'detail': ''
    };

    // If search is provided, we filter on the router side
    if (search && search.trim() !== '') {
      queryParams['?name'] = search;
    }

    // Apply status filter
    if (filter === 'active') {
      queryParams['?disabled'] = 'no';
    } else if (filter === 'disabled') {
      queryParams['?disabled'] = 'yes';
    }

    const raw = await mikrotik.execute(req.session.id, '/tool/user-manager/user/print', queryParams);

    const users = (raw || []).map((u, idx) => {
      const isDisabled = u.disabled === 'true' || u.disabled === true;
      const comment = fixEncoding(u.comment || '');

      return {
        id: u['.id'],
        username: u.name || u.username || '--',
        customer: u.customer || 'افتراضي',
        profile: u['actual-profile'] || u.profile || 'بدون باقة',
        actualProfile: u['actual-profile'] || '',
        password: u.password || '',
        comment: comment,
        uptimeUsed: u['uptime-used'] || '0s',
        downloadUsed: formatBytes(u['download-used']),
        uploadUsed: formatBytes(u['upload-used']),
        totalUsed: formatBytes((parseInt(u['download-used']) || 0) + (parseInt(u['upload-used']) || 0)),
        lastSeen: u['last-seen'] || 'never',
        isDisabled
      };
    });

    res.json({
      users,
      pagination: {
        page,
        limit,
        total: totalUsers,
        enabled: enabledUsers,
        disabled: disabledUsers,
        totalPages: Math.ceil(totalUsers / limit)
      }
    });

  } catch (err) {
    console.error('User Manager error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/user-manager/profiles ─────────────────────────────────────────
router.get('/profiles', requireAuth, async (req, res) => {
  try {
    const raw = await mikrotik.execute(req.session.id, '/tool/user-manager/profile/print', {});
    const profiles = (raw || []).map(p => ({
      name: p.name,
      id: p['.id']
    }));
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/user-manager/customers ────────────────────────────────────────
router.get('/customers', requireAuth, async (req, res) => {
  try {
    const raw = await mikrotik.execute(req.session.id, '/tool/user-manager/customer/print', {});
    const customers = (raw || []).map(c => ({
      login: c.login,
      id: c['.id']
    }));
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/user-manager/user/add ────────────────────────────────────────
router.post('/user/add', requireAuth, async (req, res) => {
  try {
    console.log('--- ADD USER DEBUG START ---');
    console.log('Request Body:', req.body);

    const {
      username, password, customer, profile,
      firstName, lastName, email, phone, location, comment
    } = req.body;

    if (!username) {
      console.log('❌ FATAL: Username is missing in request body');
      return res.status(400).json({ error: 'Username is required' });
    }

    // 1. ADD USER - EXACT FLUTTER SEQUENCE
    const addWords = [
      `=customer=${customer || 'admin'}`,
      `=disabled=no`,
      `=username=${username}`,
      `=password=${password || ''}`,
      `=shared-users=1`,
      `=first-name=${firstName || ''}`,
      `=last-name=${lastName || ''}`,
      `=email=${email || ''}`,
      `=phone=${phone || ''}`,
      `=location=${location || ''}`,
      `=comment=${comment || ''}`
    ];

    console.log('FLUTTER STYLE STEP 1 (Add):', addWords);
    // Explicitly using the array form to trigger Raw mode in our mikrotik.js
    await mikrotik.execute(req.session.id, '/tool/user-manager/user/add', addWords);

    // 2. ACTIVATE PROFILE - EXACT FLUTTER SEQUENCE
    if (profile) {
      const activateWords = [
        `=numbers=${username}`,
        `=customer=${customer || 'admin'}`,
        `=profile=${profile}`
      ];
      console.log('FLUTTER STYLE STEP 2 (Activate):', activateWords);
      await mikrotik.execute(req.session.id, '/tool/user-manager/user/create-and-activate-profile', activateWords);
    }

    res.json({ success: true, message: 'تم إضافة المستخدم بنجاح' });
  } catch (err) {
    console.error('API Error (Flutter Style):', err);
    if (err.message.includes('already exists')) {
      return res.status(400).json({ error: 'المستخدم موجود مسبقاً' });
    }
    res.status(500).json({ error: `فشل في إضافة المستخدم: ${err.message}` });
  }
});

module.exports = router;
