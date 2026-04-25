/**
 * MikroTik Dashboard - Main Server
 * Handles HTTP requests and serves the web application
 */

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const iconv = require('iconv-lite');

// 🚀 RADICAL FIX: MikroTik library hardcodes 'win1252' which destroys Arabic bytes.
// We intercept this and force 'latin1' to preserve original bytes 1-to-1.
const originalDecode = iconv.decode;
iconv.decode = function(buf, encoding, options) {
  const targetEncoding = (encoding === 'win1252') ? 'latin1' : encoding;
  return originalDecode.call(iconv, buf, targetEncoding, options);
};

const authRoutes = require('./routes/auth');
const resourceRoutes = require('./routes/resources');
const healthRoutes = require('./routes/health');
const interfaceRoutes = require('./routes/interfaces');
const hotspotRoutes = require('./routes/hotspotUsers');
const userManagerRoutes = require('./routes/userManager');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session management
app.use(session({
  secret: 'mikrotik-dashboard-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,        // set to true if using HTTPS
    httpOnly: true,
    maxAge: 30 * 60 * 1000 // 30 minutes
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/interfaces', interfaceRoutes);
app.use('/api/hotspot', hotspotRoutes);
app.use('/api/user-manager', userManagerRoutes);
console.log('✅ Hotspot routes registered at /api/hotspot');
console.log('✅ User Manager routes registered at /api/user-manager');

// ─── Page Routes ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/dashboard', (req, res) => {
  if (!req.session.connected) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// ─── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 MikroTik Dashboard running at http://localhost:${PORT}`);
  console.log(`📡 Waiting for router connections...\n`);
});
