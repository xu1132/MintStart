const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const TOKEN_KEY = 'mintstart-auth-token'

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function saveAuthToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const token = getAuthToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  let payload = null
  try { payload = await response.json() } catch { /* empty response */ }
  if (!response.ok) {
    const error = new Error(payload?.error || `请求失败（${response.status}）`)
    error.status = response.status
    throw error
  }
  return payload
}

export const authApi = {
  register: (account, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ account, password }) }),
  login: (account, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ account, password }) }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  changePassword: (currentPassword, newPassword) => request('/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  }),
  updateSearchEngine: (searchEngine) => request('/auth/settings/search-engine', {
    method: 'PUT',
    body: JSON.stringify({ searchEngine }),
  }),
}

export const desktopApi = {
  get: () => request('/desktop'),
  save: (items) => request('/desktop', { method: 'PUT', body: JSON.stringify({ items }) }),
  heartbeat: (sessionId) => request('/usage/heartbeat', { method: 'POST', body: JSON.stringify({ sessionId }) }),
}

export const adminApi = {
  overview: () => request('/admin/overview'),
  users: () => request('/admin/users'),
  resetPassword: (userId, newPassword) => request(`/admin/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  }),
}
