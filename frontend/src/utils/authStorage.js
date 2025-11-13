// Simple per-tab auth storage utility
// Uses sessionStorage to isolate sessions per tab. Falls back to localStorage for backward compatibility when reading.

export const setAuth = ({ token, role, userName, email }) => {
  try {
    if (token != null) sessionStorage.setItem('token', token);
    if (role != null) sessionStorage.setItem('role', String(role).toLowerCase());
    if (userName != null) sessionStorage.setItem('userName', userName);
    if (email != null) sessionStorage.setItem('email', email);
  } catch (_) {
    // ignore storage errors
  }
};

export const clearAuth = () => {
  try {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('email');
  } catch (_) {}
  // Also clear legacy localStorage keys to avoid stale state when navigating within same tab
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    localStorage.removeItem('email');
  } catch (_) {}
};

const read = (key) => {
  try {
    const v = sessionStorage.getItem(key);
    if (v != null) return v;
  } catch (_) {}
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
};

export const getToken = () => read('token') || '';
export const getRole = () => (read('role') || '').toLowerCase();
export const getUserName = () => read('userName') || '';
export const getEmail = () => read('email') || '';
