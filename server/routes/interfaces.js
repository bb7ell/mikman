/**
 * Interfaces Route
 * GET /api/interfaces — Fetch active network interfaces
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

// GET /api/interfaces
router.get('/', requireAuth, async (req, res) => {
  try {
    const data = await mikrotik.execute(req.session.id, '/interface/print');

    const interfaces = data.map(iface => ({
      name:      iface.name      || '--',
      type:      iface.type      || '--',
      running:   iface.running   === 'true',
      disabled:  iface.disabled  === 'true',
      txByte:    iface['tx-byte']   || '0',
      rxByte:    iface['rx-byte']   || '0',
      txPacket:  iface['tx-packet'] || '0',
      rxPacket:  iface['rx-packet'] || '0',
      macAddress: iface['mac-address'] || '--',
      comment:   iface.comment   || '',
    }));

    res.json(interfaces);
  } catch (err) {
    if (err.message === 'NOT_CONNECTED' || err.message === 'CONNECTION_LOST') {
      return res.status(401).json({ error: 'Router connection lost' });
    }
    console.error('Interfaces error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
