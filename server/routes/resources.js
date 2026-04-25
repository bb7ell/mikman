/**
 * System Resources Route
 * GET /api/resources — Fetch /system resource print
 */

const express = require('express');
const router = express.Router();
const mikrotik = require('../mikrotik');

// Middleware: require active session
function requireAuth(req, res, next) {
  if (!req.session.connected || !mikrotik.isConnected(req.session.id)) {
    return res.status(401).json({ error: 'Not connected' });
  }
  next();
}

// GET /api/resources
router.get('/', requireAuth, async (req, res) => {
  try {
    const data = await mikrotik.execute(req.session.id, '/system/resource/print');
    const r = data[0] || {};

    res.json({
      uptime:            r.uptime           || '--',
      version:           r.version          || '--',
      buildTime:         r['build-time']    || '--',
      factorySoftware:   r['factory-software'] || '--',
      freeMemory:        r['free-memory']   || '--',
      totalMemory:       r['total-memory']  || '--',
      cpu:               r.cpu              || '--',
      cpuCount:          r['cpu-count']     || '--',
      cpuFrequency:      r['cpu-frequency'] || '--',
      cpuLoad:           r['cpu-load']      || '--',
      freeHddSpace:      r['free-hdd-space']  || '--',
      totalHddSpace:     r['total-hdd-space'] || '--',
      architectureName:  r['architecture-name'] || '--',
      boardName:         r['board-name']    || '--',
      platform:          r.platform         || '--',
      // Computed percentages
      memoryPercent: computePercent(r['free-memory'], r['total-memory']),
      hddPercent:    computePercent(r['free-hdd-space'], r['total-hdd-space']),
    });
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/resources/counts
router.get('/counts', requireAuth, async (req, res) => {
  try {
    // We execute the 3 commands concurrently using raw array params to pass `=count-only=`
    const [hotspotUsers, activeUsers, umUsers] = await Promise.allSettled([
      mikrotik.execute(req.session.id, '/ip/hotspot/user/print', ['=count-only=']),
      mikrotik.execute(req.session.id, '/ip/hotspot/active/print', ['=count-only=']),
      mikrotik.execute(req.session.id, '/tool/user-manager/user/print', ['=count-only='])
    ]);

    const extractCount = (result) => {
      if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
        return parseInt(result.value[0].ret || 0, 10);
      }
      return 0;
    };

    res.json({
      users: extractCount(hotspotUsers),
      active: extractCount(activeUsers),
      userman: extractCount(umUsers)
    });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * Convert "123.4MiB" strings to percent used
 */
function computePercent(freeStr, totalStr) {
  const free  = parseMiB(freeStr);
  const total = parseMiB(totalStr);
  if (!total) return 0;
  return Math.round(((total - free) / total) * 100);
}

function parseMiB(str) {
  if (!str) return 0;
  const match = str.match(/([\d.]+)\s*(MiB|GiB|KiB|B)?/i);
  if (!match) return 0;
  const val  = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();
  const map  = { B: 1, KIB: 1024, MIB: 1024 ** 2, GIB: 1024 ** 3 };
  return val * (map[unit] || 1);
}

function handleError(res, err) {
  if (err.message === 'NOT_CONNECTED' || err.message === 'CONNECTION_LOST') {
    return res.status(401).json({ error: 'Router connection lost' });
  }
  console.error('Resources error:', err.message);
  res.status(500).json({ error: err.message });
}

module.exports = router;
