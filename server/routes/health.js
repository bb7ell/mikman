/**
 * System Health Route
 * GET /api/health — Fetch /system health print
 */

const express = require('express');
const router = express.Router();
const mikrotik = require('../mikrotik');

function requireAuth(req, res, next) {
  if (!req.session.connected || !mikrotik.isConnected(req.session.id)) {
    return res.status(401).json({ error: 'Not connected' });
  }
  next();
}

// GET /api/health
router.get('/', requireAuth, async (req, res) => {
  try {
    const data = await mikrotik.execute(req.session.id, '/system/health/print');
    const h = data[0] || {};

    res.json({
      voltage:          h.voltage           || '--',
      current:          h.current           || '--',
      temperature:      h.temperature       || '--',
      powerConsumption: h['power-consumption'] || '--',
      psu1Voltage:      h['psu1-voltage']   || '--',
      psu2Voltage:      h['psu2-voltage']   || '--',
    });
  } catch (err) {
    // Health data may not be available on all models — return nulls gracefully
    if (err.message && err.message.includes('no such command')) {
      return res.json({ unsupported: true });
    }
    if (err.message === 'NOT_CONNECTED' || err.message === 'CONNECTION_LOST') {
      return res.status(401).json({ error: 'Router connection lost' });
    }
    console.error('Health error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
