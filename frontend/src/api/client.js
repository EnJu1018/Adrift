export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'adrift_token';
const USER_KEY = 'adrift_user';

export function getStoredAuth() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    return {
      token,
      user: savedUser ? JSON.parse(savedUser) : null
    };
  } catch {
    clearStoredAuth();
    return { token: null, user: null };
  }
}

export function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}`;
}

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.message || response.statusText || 'Request failed');
    error.status = response.status;
    error.payload = payload;

    if (response.status === 401 && !path.startsWith('/auth/')) {
      clearStoredAuth();
      window.dispatchEvent(new CustomEvent('adrift:auth-expired', { detail: { message: error.message } }));
    }

    throw error;
  }

  return payload;
}

export const api = {
  login(payload) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  register(payload) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  getDiaries(params = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== '')
    ).toString();

    return request(`/diaries${query ? `?${query}` : ''}`);
  },
  getMemories() {
    return request('/diaries/memories');
  },
  getExploreDiaries(params = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== '')
    ).toString();

    return request(`/diaries/explore${query ? `?${query}` : ''}`);
  },
  createDiary(formData) {
    return request('/diaries', {
      method: 'POST',
      body: formData
    });
  },
  deleteDiary(id) {
    return request(`/diaries/${id}`, { method: 'DELETE' });
  },
  reactToDiary(id, type) {
    return request(`/diaries/${id}/react`, {
      method: 'POST',
      body: JSON.stringify({ type })
    });
  },
  searchUser(userCode) {
    const query = new URLSearchParams({ userCode }).toString();
    return request(`/users/search?${query}`);
  },
  sendFriendRequest(targetUserId) {
    return request('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ targetUserId })
    });
  },
  getFriendRequests() {
    return request('/friends/requests');
  },
  getSentFriendRequests() {
    return request('/friends/requests/sent');
  },
  cancelFriendRequest(requestId) {
    return request(`/friends/requests/${requestId}/cancel`, { method: 'DELETE' });
  },
  acceptFriendRequest(requestId) {
    return request(`/friends/requests/${requestId}/accept`, { method: 'POST' });
  },
  rejectFriendRequest(requestId) {
    return request(`/friends/requests/${requestId}/reject`, { method: 'POST' });
  },
  getFriends() {
    return request('/friends');
  },
  getLifeMapInsight() {
    return request('/ai/life-map');
  },
  getAdminStats() {
    return request('/admin/stats');
  },
  getAdminUsers(params = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== '' && value !== 'all')
    ).toString();
    return request(`/admin/users${query ? `?${query}` : ''}`);
  },
  getAdminDiaries(params = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== '' && value !== 'all')
    ).toString();
    return request(`/admin/diaries${query ? `?${query}` : ''}`);
  },
  updateAdminUserRole(id, role) {
    return request(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    });
  },
  deleteAdminDiary(id) {
    return request(`/admin/diaries/${id}`, { method: 'DELETE' });
  },
  getMe() {
    return request('/users/me');
  },
  updateName(name) {
    return request('/users/me/name', {
      method: 'PATCH',
      body: JSON.stringify({ name })
    });
  },
  updateEmail(payload) {
    return request('/users/me/email', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },
  updatePassword(payload) {
    return request('/users/me/password', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },
  deleteAccount(payload) {
    return request('/users/me', {
      method: 'DELETE',
      body: JSON.stringify(payload)
    });
  }
};
