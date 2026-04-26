/**
 * Authentication Routes
 * POST /api/auth/login  — Connect to router & start session
 * POST /api/auth/logout — Disconnect and destroy session
 * GET  /api/auth/status — Check current connection status
 */

const express = require('express');
const router = express.Router();
const mikrotik = require('../mikrotik');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { host, port, username, password } = req.body;

  if (!host || !username || !password) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const sessionId = req.session.id;
  const result = await mikrotik.connect(sessionId, { host, port: port || 8728, username, password });

  if (result.success) {
    req.session.connected = true;
    req.session.routerInfo = { host, port: port || 8728, username };
    return res.json({ success: true, redirect: '/dashboard' });
  }

  return res.status(401).json({ success: false, error: result.error });
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  await mikrotik.disconnect(req.session.id);
  req.session.destroy();
  res.json({ success: true });
});

// GET /api/auth/status
router.get('/status', (req, res) => {
  const connected = req.session.connected && mikrotik.isConnected(req.session.id);
  res.json({
    connected: !!connected,
    routerInfo: connected ? req.session.routerInfo : null
  });
});

const db = require('../db');

// GET /api/auth/saved-routers
router.get('/saved-routers', (req, res) => {
  db.all('SELECT * FROM saved_routers', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, routers: rows });
  });
});

// POST /api/auth/saved-routers
router.post('/saved-routers', (req, res) => {
  const { name, host, port, username, password } = req.body;
  if (!name || !host || !username) {
    return res.status(400).json({ success: false, error: 'Name, Host, and Username are required' });
  }

  const stmt = db.prepare('INSERT INTO saved_routers (name, host, port, username, password) VALUES (?, ?, ?, ?, ?)');
  stmt.run([name, host, port || 8728, username, password], function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, id: this.lastID });
  });
});

// DELETE /api/auth/saved-routers/:id
router.delete('/saved-routers/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM saved_routers WHERE id = ?', id, function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true });
  });
});

module.exports = router;
