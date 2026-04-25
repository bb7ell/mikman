/**
 * api.js — Shared API client for all frontend pages
 * Wraps fetch calls with error handling and session management
 */

const API = (() => {

  /**
   * Internal fetch wrapper
   */
  async function request(method, url, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    };
    if (body) opts.body = JSON.stringify(body);

    try {
      const res = await fetch(url, opts);
      const data = await res.json();

      if (!res.ok) {
        throw new APIError(data.error || `HTTP ${res.status}`, res.status);
      }
      return data;
    } catch (err) {
      if (err instanceof APIError) throw err;
      throw new APIError('Network error — cannot reach server', 0);
    }
  }

  // ── Auth ───────────────────────────────────────────────────────────
  async function login(host, port, username, password) {
    return request('POST', '/api/auth/login', { host, port, username, password });
  }

  async function logout() {
    return request('POST', '/api/auth/logout');
  }

  async function getStatus() {
    return request('GET', '/api/auth/status');
  }

  // ── Resources ──────────────────────────────────────────────────────
  async function getResources() {
    return request('GET', '/api/resources');
  }

  // ── Health ─────────────────────────────────────────────────────────
  async function getHealth() {
    return request('GET', '/api/health');
  }

  // ── Interfaces ─────────────────────────────────────────────────────
  async function getInterfaces() {
    return request('GET', '/api/interfaces');
  }

  // ── Hotspot Users ──────────────────────────────────────────────────
  async function getHotspotUsers() {
    return request('GET', '/api/hotspot/users');
  }

  // ── User Manager ──────────────────────────────────────────────────
  async function getUserManagerUsers(page = 1, limit = 50, search = '', filter = '') {
    return request('GET', `/api/user-manager/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&filter=${encodeURIComponent(filter)}`);
  }

  async function getUserManagerProfiles() {
    return request('GET', '/api/user-manager/profiles');
  }

  async function getUserManagerCustomers() {
    return request('GET', '/api/user-manager/customers');
  }

  async function addUserManagerUser(userData) {
    return request('POST', '/api/user-manager/user/add', userData);
  }

  return { 
    login, 
    logout, 
    getStatus, 
    getResources, 
    getHealth, 
    getInterfaces, 
    getHotspotUsers, 
    getHotspotActive: () => request('GET', '/api/hotspot/active'),
    removeHotspotActive: (id) => request('DELETE', `/api/hotspot/active/${id}`),
    getUserManagerUsers,
    getUserManagerProfiles,
    getUserManagerCustomers,
    addUserManagerUser,
    getQuickCounts: () => request('GET', '/api/resources/counts')
  };
})();

/** Custom error with HTTP status code */
class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = 'APIError';
  }
}
