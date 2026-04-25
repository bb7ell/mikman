/**
 * Hotspot Users Route
 * GET /api/hotspot/users — Fetch and parse /ip/hotspot/user/print detail
 */

const express = require('express');
const router = express.Router();
const mikrotik = require('../mikrotik');
const iconv = require('iconv-lite');

// ── Month name → number map ────────────────────────────────────────
const MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

const fs = require('fs');
const path = require('path');
const debugLog = fs.createWriteStream(path.join(__dirname, '../../debug.log'), { flags: 'a' });

function log(msg, data = '') {
  const timestamp = new Date().toISOString();
  const output = `[${timestamp}] ${msg} ${data ? JSON.stringify(data, null, 2) : ''}\n`;
  debugLog.write(output);
  console.log(output);
}

function requireAuth(req, res, next) {
  log('🔐 Checking Auth...', { connected: req.session.connected, id: req.session.id });
  if (!req.session.connected || !mikrotik.isConnected(req.session.id)) {
    log('❌ Auth Failed: User not connected or session lost');
    return res.status(401).json({ error: 'Not connected' });
  }
  log('✅ Auth Success');
  next();
}

/**
 * 🚀 RADICAL FIX: Advanced decoding to fix Arabic Mojibake from RouterOS
 * Now works with the 'latin1' encoding forced in the MikroTik client
 */
function fixEncoding(str) {
  if (!str || typeof str !== 'string') return '';

  // 1. Convert the mangled string back to raw bytes (using latin1 preservation)
  const buf = Buffer.from(str, 'latin1');

  // 2. Try UTF-8 first (Modern MikroTik sends UTF-8)
  const utf8Str = buf.toString('utf8');
  if (/[\u0600-\u06FF]/.test(utf8Str)) {
    return utf8Str;
  }

  // 3. Try Windows-1256 (Legacy MikroTik Arabic)
  const win1256Str = iconv.decode(buf, 'win1256');
  if (/[\u0600-\u06FF]/.test(win1256Str)) {
    return win1256Str;
  }

  // Fallback to original or UTF-8
  return utf8Str || str;
}

/**
 * Parse comment field: extract name <>, price $$, and date
 */
function parseComment(rawComment) {
  const comment = fixEncoding(rawComment);
  const result = { startDate: null, customerName: '', price: null };
  if (!comment) return result;

  // Extract name between < >
  const nameMatch = comment.match(/<([^>]*)>/);
  if (nameMatch && nameMatch[1].trim()) {
    result.customerName = fixEncoding(nameMatch[1].trim());
  }

  // Extract price between $ $ (last occurrence wins)
  const priceMatches = [...comment.matchAll(/\$(\d+)\$/g)];
  if (priceMatches.length > 0) {
    result.price = parseInt(priceMatches[priceMatches.length - 1][1]);
  }

  // Extract date: e.g. "apr/05/2026_17:50:07" or "apr/05/2026"
  const dateMatch = comment.match(
    /([a-z]{3})\/(\d{2})\/(\d{4})(?:_(\d{2}):(\d{2}):(\d{2}))?/i
  );
  if (dateMatch) {
    const [, mon, day, year, hh = '00', mm = '00', ss = '00'] = dateMatch;
    const month = MONTHS[mon.toLowerCase()];
    if (month) {
      const dateStr = `${year}-${month}-${day}T${hh}:${mm}:${ss}`;
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime())) {
        result.startDate = parsedDate;
      }
    }
  }

  return result;
}

/**
 * Extract validity in days from email field.
 * e.g. "30@nobind.com" → 30,  "50@nobind.com" → 50
 */
function parseValidityDays(email, limitUptime) {
  if (email && typeof email === 'string') {
    const m = email.match(/^(\d+)@/);
    if (m) return parseInt(m[1]);
  }
  // Fallback: parse routeros duration like "4w2d" or "30d"
  if (limitUptime) return parseDuration(limitUptime);
  return null;
}

/** Parse RouterOS duration string → total days */
function parseDuration(str) {
  if (!str || typeof str !== 'string') return null;
  let days = 0;
  const w = str.match(/(\d+)w/); if (w) days += parseInt(w[1]) * 7;
  const d = str.match(/(\d+)d/); if (d) days += parseInt(d[1]);
  return days > 0 ? days : null;
}

/** Parse RouterOS duration string → total seconds */
function parseDurationSec(str) {
  if (!str || typeof str !== 'string') return 0;
  let sec = 0;
  const w = str.match(/(\d+)w/); if (w) sec += parseInt(w[1]) * 604800;
  const d = str.match(/(\d+)d/); if (d) sec += parseInt(d[1]) * 86400;
  const h = str.match(/(\d+)h/); if (h) sec += parseInt(h[1]) * 3600;
  const m = str.match(/(\d+)m/); if (m) sec += parseInt(m[1]) * 60;
  const s = str.match(/(\d+)s/); if (s) sec += parseInt(s[1]);
  return sec;
}

/** Format bytes into human-readable string */
function formatBytes(bytes) {
  const n = parseInt(bytes) || 0;
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' TB';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' MB';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' KB';
  return n + ' B';
}

/** Determine user status with improved logic */
function getUserStatus(user, endDate, isDisabled) {
  const now = new Date();

  if (isDisabled) return 'disabled';
  if (endDate && endDate < now) return 'expired';

  // Check if user has active session (uptime > 0 and not "0s")
  const uptime = user.uptime || '0s';
  if (uptime !== '0s' && parseDurationSec(uptime) > 0) {
    return 'active';
  }

  // If has valid end date in future, consider active (pre-paid)
  if (endDate && endDate > now) {
    return 'active';
  }

  return 'inactive';
}

// ── GET /api/hotspot/users ─────────────────────────────────────────
router.get('/users', requireAuth, async (req, res) => {
  log('🚀 [1] Entering /api/hotspot/users');
  try {
    log('🚀 [2] Executing print command on router...');
    const raw = await mikrotik.execute(req.session.id, '/ip/hotspot/user/print', { detail: '' });
    
    log('🚀 [3] Data received from router. Count:', raw ? raw.length : 0);

    if (raw && raw.length > 0) {
      const sample = raw.find(u => u.comment && u.comment.includes('<')) || raw[0];
      log('🚀 [4] Sample Raw Item:', sample);
      if (sample.comment) {
        log('🚀 [5] Comment Hex:', Buffer.from(sample.comment, 'latin1').toString('hex'));
      }
    } else {
      log('🚀 [4] No users found in raw response.');
    }

    const users = (raw || []).map((u, idx) => {
      // 🛠️ Diagnostic: Log hex of name for the first 3 users to identify encoding
      if (idx < 3) {
        const nameComment = u.comment || '';
        const hex = Buffer.from(nameComment, 'latin1').toString('hex');
        console.log(`[Diagnostic] User ${idx} raw comment hex: ${hex}`);
      }

      // Safe flag checking
      const flags = u['.flags'] || '';
      const isDisabled = flags.includes('X') || u.disabled === 'true' || u.disabled === true;
      const isDefault = u.name === 'default' || u.name === 'default-trial';

      // Parse comment with encoding fix
      const rawComment = u.comment || '';
      const { startDate, customerName, price } = parseComment(rawComment);

      // Calculate validity and dates
      const validityDays = parseValidityDays(u.email, u['limit-uptime']);
      const endDate = (startDate && validityDays && !isNaN(startDate.getTime()))
        ? new Date(startDate.getTime() + validityDays * 86400000)
        : null;

      // Data usage calculations
      const bytesIn = parseInt(u['bytes-in']) || 0;
      const bytesOut = parseInt(u['bytes-out']) || 0;
      const limitBytes = parseInt(u['limit-bytes-total']) || 0;
      const totalUsed = bytesIn + bytesOut;

      // Uptime calculations
      const uptimeSec = parseDurationSec(u.uptime);
      const limitUptimeSec = parseDurationSec(u['limit-uptime']);

      const usagePercent = limitBytes > 0
        ? Math.min(Math.round((totalUsed / limitBytes) * 100), 100)
        : 0;
      const uptimePercent = limitUptimeSec > 0
        ? Math.min(Math.round((uptimeSec / limitUptimeSec) * 100), 100)
        : 0;

      // Days remaining calculation
      const now = new Date();
      let daysRemaining = null;
      if (endDate && !isNaN(endDate.getTime())) {
        daysRemaining = Math.ceil((endDate - now) / 86400000);
      }

      return {
        index: idx,
        id: u['.id'] || String(idx),
        name: u.name || '--',
        customerName: customerName || '',
        profile: u.profile || '--',
        email: u.email || '',
        comment: fixEncoding(rawComment),
        isDisabled,
        isDefault,
        status: getUserStatus(u, endDate, isDisabled),

        // Dates (ISO format with null check)
        startDate: (startDate && !isNaN(startDate.getTime())) ? startDate.toISOString() : null,
        endDate: (endDate && !isNaN(endDate.getTime())) ? endDate.toISOString() : null,
        validityDays,
        daysRemaining: daysRemaining !== null ? Math.max(0, daysRemaining) : null,

        // Financial
        price,

        // Uptime
        uptime: u.uptime || '0s',
        limitUptime: u['limit-uptime'] || '--',
        uptimePercent,

        // Data usage
        bytesIn,
        bytesOut,
        totalUsed,
        limitBytes,
        usagePercent,
        bytesInStr: formatBytes(bytesIn),
        bytesOutStr: formatBytes(bytesOut),
        totalUsedStr: formatBytes(totalUsed),
        limitBytesStr: limitBytes > 0 ? formatBytes(limitBytes) : '∞',

        // Packets
        packetsIn: u['packets-in'] || '0',
        packetsOut: u['packets-out'] || '0',

        macAddress: u['mac-address'] || '',
        server: u.server || '',
      };
    });

    res.json({ users, total: users.length });

  } catch (err) {
    log('💥 Fatal Error in /users:', err.message);
    console.error(err);
    if (err.message === 'NOT_CONNECTED' || err.message === 'CONNECTION_LOST') {
      return res.status(401).json({ error: 'Router connection lost' });
    }
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── GET /api/hotspot/profiles ──────────────────────────────────────
router.get('/profiles', requireAuth, async (req, res) => {
  try {
    const profiles = await mikrotik.execute(req.session.id, '/ip/hotspot/user/profile/print');
    res.json(profiles.map(p => ({ name: p.name })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POS /api/hotspot/users/add ────────────────────────────────────────
router.post('/add', requireAuth, async (req, res) => {
  const { 
    name, password, profile, 
    limitBytesTotal, limitUptime, 
    price, note, pos,
    validityValue, validityUnit 
  } = req.body;

  if (!name || !profile) {
    return res.status(400).json({ error: 'Name and Profile are required' });
  }

  try {
    // 1. Construct Email (e.g. "30@nobind.com" or "1h@nobind.com")
    const email = validityUnit === 'hours' 
      ? `${validityValue}h@nobind.com` 
      : `${validityValue}@nobind.com`;

    // 2. Construct Comment (e.g. "apr/24/2026_16:45:00<note>$price$@pos@")
    const now = new Date();
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monStr = months[now.getMonth()];
    const dayStr = String(now.getDate()).padStart(2, '0');
    const yearStr = now.getFullYear();
    const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
    const commentDate = `${monStr}/${dayStr}/${yearStr}_${timeStr}`;
    const comment = `${commentDate}<${note || ''}>$${price || '0'}$@${pos || ''}@`;

    // 3. Prepare parameters for MikroTik API in word format (=key=value)
    const words = [
      `=name=${name}`,
      `=password=${password || ''}`,
      `=profile=${profile}`,
      `=email=${email}`,
      `=comment=${comment}`,
      `=limit-bytes-total=${limitBytesTotal || '0'}`,
      `=limit-uptime=${limitUptime || '0s'}`,
      `=server=all`
    ];

    log('📝 [Backend] Final Words for RouterOS:', words);
    await mikrotik.execute(req.session.id, '/ip/hotspot/user/add', words);
    
    res.json({ success: true, message: 'User added successfully' });
  } catch (err) {
    log('💥 Error adding user:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Active Sessions ────────────────────────────────────────────────
router.get('/active', requireAuth, async (req, res) => {
  log('🚀 Entering /api/hotspot/active');
  try {
    const raw = await mikrotik.execute(req.session.id, '/ip/hotspot/active/print', { detail: '' });
    
    const active = (raw || []).map((u, idx) => {
      return {
        id: u['.id'] || String(idx),
        server: u.server || 'unknown',
        user: fixEncoding(u.user) || 'unknown',
        address: u.address || '--',
        macAddress: u['mac-address'] || '--',
        loginBy: u['login-by'] || '--',
        uptime: u.uptime || '0s',
        sessionTimeLeft: u['session-time-left'] || '--',
        limitBytesTotal: u['limit-bytes-total'] ? formatBytes(u['limit-bytes-total']) : '∞',
        limitBytesIn: u['limit-bytes-in'] ? formatBytes(u['limit-bytes-in']) : '--',
        limitBytesOut: u['limit-bytes-out'] ? formatBytes(u['limit-bytes-out']) : '--',
        keepaliveTimeout: u['keepalive-timeout'] || '--',
        comment: fixEncoding(u.comment) || ''
      };
    });

    res.json({ active, total: active.length });
  } catch (err) {
    log('💥 Error in /active:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.delete('/active/:id', requireAuth, async (req, res) => {
  try {
    await mikrotik.execute(req.session.id, '/ip/hotspot/active/remove', { '.id': req.params.id });
    res.json({ success: true, message: 'Session closed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;