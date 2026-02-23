/**
 * NBS-AI Frontend API Helper
 * Centralizes all backend API calls.
 * Change API_BASE here to switch between development and production.
 */

const API_BASE = 'http://localhost:5000';

/**
 * Get stored auth token from localStorage
 */
function getToken() {
    return localStorage.getItem('nbsToken');
}

/**
 * Get stored user object from localStorage
 */
function getUser() {
    const userStr = localStorage.getItem('nbsUser');
    return userStr ? JSON.parse(userStr) : null;
}

/**
 * Save auth data to localStorage after login
 */
function saveAuth(token, user) {
    localStorage.setItem('nbsToken', token);
    localStorage.setItem('nbsUser', JSON.stringify(user));
}

/**
 * Clear auth data (logout)
 */
function clearAuth() {
    localStorage.removeItem('nbsToken');
    localStorage.removeItem('nbsUser');
    localStorage.removeItem('nbsTrialUsed');
}

/**
 * Check if user is logged in
 */
function isLoggedIn() {
    return !!getToken() && !!getUser();
}

/**
 * Check if logged-in user is admin
 */
function isAdmin() {
    const user = getUser();
    return user && user.role === 'admin';
}

/**
 * Build headers with auth token
 */
function authHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}

/**
 * Make an authenticated GET request
 * @param {string} path - API path e.g. '/api/auth/user'
 */
async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: authHeaders()
    });
    return res;
}

/**
 * Make an authenticated POST request
 * @param {string} path - API path
 * @param {object|FormData} body - JSON body or FormData
 */
async function apiPost(path, body = {}) {
    let headers = authHeaders();
    let fetchOptions = {
        method: 'POST',
        headers: headers
    };

    if (body instanceof FormData) {
        // Remove Content-Type so fetch can auto-generate it with the boundary
        delete headers['Content-Type'];
        fetchOptions.body = body;
    } else {
        fetchOptions.body = JSON.stringify(body);
    }

    const res = await fetch(`${API_BASE}${path}`, fetchOptions);
    return res;
}

/**
 * Make an authenticated PUT request
 * @param {string} path - API path
 * @param {object} body - JSON body
 */
async function apiPut(path, body = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body)
    });
    return res;
}

/**
 * Make an authenticated DELETE request
 * @param {string} path - API path
 */
async function apiDelete(path) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'DELETE',
        headers: authHeaders()
    });
    return res;
}

/**
 * Logout: clear auth and redirect to login page
 */
function logout() {
    clearAuth();
    window.location.href = 'login.html';
}

/**
 * Guard: redirect to login if not authenticated
 */
function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

/**
 * Guard: redirect to dashboard if not admin
 */
function requireAdmin() {
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return false;
    }
    if (!isAdmin()) {
        window.location.href = 'dashboard.html';
        return false;
    }
    return true;
}
