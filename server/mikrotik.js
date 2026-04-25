/**
 * MikroTik API Connection Manager
 * Handles connection pooling and communication with RouterOS API (port 8728)
 */

const RouterOSAPI = require('node-routeros').RouterOSAPI;

// Active connections map: sessionId -> RouterOS client
const connections = new Map();

/**
 * Connect to a MikroTik router
 * @param {string} sessionId - Unique session identifier
 * @param {object} params - Connection parameters
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function connect(sessionId, { host, port, username, password }) {
  try {
    // Close existing connection if any
    await disconnect(sessionId);

    const api = new RouterOSAPI({
      host,
      port: parseInt(port) || 8728,
      user: username,
      password,
      timeout: 10,
      keepalive: true,
      encoding: 'latin1' // إجبار المكتبة على استقبال البيانات خام دون تخريبها
    });

    await api.connect();
    connections.set(sessionId, api);

    console.log(`✅ Connected [${sessionId}] → ${host}:${port} as ${username}`);
    return { success: true };

  } catch (err) {
    console.error(`❌ Connection failed [${sessionId}]: ${err.message}`);
    return { success: false, error: parseError(err) };
  }
}

/**
 * Disconnect and cleanup a session
 * @param {string} sessionId
 */
async function disconnect(sessionId) {
  const api = connections.get(sessionId);
  if (api) {
    try {
      api.close();
    } catch (_) {}
    connections.delete(sessionId);
    console.log(`🔌 Disconnected [${sessionId}]`);
  }
}

/**
 * Execute a RouterOS command on an active connection
 * @param {string} sessionId
 * @param {string} command - RouterOS API command path
 * @param {object} [params] - Optional command parameters
 * @returns {Promise<Array>}
 */
async function execute(sessionId, command, params = {}) {
  const api = connections.get(sessionId);
  if (!api) {
    throw new Error('NOT_CONNECTED');
  }

  try {
    // ⚔️ RADICAL FIX: If params is an array, it means we want RAW execution (Flutter style)
    // We must pass it to write() directly. The node-routeros library
    // sometimes sorts objects alphabetically, but we need strict sequence.
    console.log(`Executing [${command}] with ${Array.isArray(params) ? 'Array (Raw)' : 'Object'} params`);
    const result = await api.write(command, params);
    return result;
  } catch (err) {
    if (err.message && err.message.includes('socket')) {
      connections.delete(sessionId);
      throw new Error('CONNECTION_LOST');
    }
    throw err;
  }
}

/**
 * Check if a session has an active connection
 * @param {string} sessionId
 * @returns {boolean}
 */
function isConnected(sessionId) {
  return connections.has(sessionId);
}

/**
 * Parse RouterOS error messages into user-friendly strings
 * @param {Error} err
 * @returns {string}
 */
function parseError(err) {
  const msg = err.message || '';
  if (msg.includes('ECONNREFUSED')) return 'Connection refused — check IP address and port';
  if (msg.includes('ETIMEDOUT') || msg.includes('timeout')) return 'Connection timed out — router unreachable';
  if (msg.includes('ENOTFOUND')) return 'Host not found — invalid IP address';
  if (msg.includes('cannot log in') || msg.includes('invalid user')) return 'Invalid username or password';
  if (msg.includes('EHOSTUNREACH')) return 'Host unreachable — check network connection';
  return `Connection failed: ${msg}`;
}

module.exports = { connect, disconnect, execute, isConnected };
