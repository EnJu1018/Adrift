export const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL);
const TOKEN_KEY = 'adrift_token';
const USER_KEY = 'adrift_user';

function resolveApiUrl(configuredUrl) {
  const fallbackUrl = configuredUrl || '/api';

  if (typeof window === 'undefined') {
    return trimTrailingSlash(fallbackUrl);
  }

  if (fallbackUrl.startsWith('/')) {
    return trimTrailingSlash(fallbackUrl);
  }

  try {
    const apiUrl = new URL(fallbackUrl, window.location.origin);
    const pageHost = window.location.hostname;
    const apiHost = apiUrl.hostname;
    const pageIsLocal = ['localhost', '127.0.0.1', '::1'].includes(pageHost);
    const apiIsLocal = ['localhost', '127.0.0.1', '::1'].includes(apiHost);

    if (!pageIsLocal && apiIsLocal) {
      return '/api';
    }

    return trimTrailingSlash(`${apiUrl.origin}${apiUrl.pathname === '/' ? '' : apiUrl.pathname}`);
  } catch {
    return trimTrailingSlash(fallbackUrl);
  }
}

function trimTrailingSlash(value) {
  return value.length > 1 ? value.replace(/\/+$/, '') : value;
}

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
  if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) return path;
  return `${API_URL}${path}`;
}

export function getDiaryEventsUrl() {
  const token = localStorage.getItem(TOKEN_KEY);
  const baseUrl = API_URL.startsWith('http') ? API_URL : `${window.location.origin}${API_URL}`;
  const url = new URL(`${baseUrl}/diaries/events`);

  if (token) {
    url.searchParams.set('token', token);
  }

  return url.toString();
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

  const response = await fetchWithDeadline(`${API_URL}${path}`, {
    ...options,
    headers
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!path.startsWith('/auth/') && token !== localStorage.getItem(TOKEN_KEY)) {
    throw new DOMException('登入狀態已變更，請重新操作。', 'AbortError');
  }

  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.message || response.statusText || 'Request failed');
    error.status = response.status;
    error.payload = payload;

    if (response.status === 401 && !path.startsWith('/auth/') && token === localStorage.getItem(TOKEN_KEY)) {
      clearStoredAuth();
      window.dispatchEvent(new CustomEvent('adrift:auth-expired', { detail: { message: error.message } }));
    }

    throw error;
  }

  if (!payload || typeof payload !== 'object') {
    return {
      success: response.ok,
      message: '',
      data: null
    };
  }

  return payload;
}

async function fetchWithDeadline(url, options) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timer = setTimeout(cancel, 30000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) throw new Error('連線逾時，請稍後重試。');
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}

export const api = {
  checkEmail(email) {
    return request('/auth/check-email', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },
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
  updateDiary(diaryId, payload) {
    return request(`/diaries/${diaryId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
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
  getFriendRecommendations(limit = 10) {
    const query = new URLSearchParams({ limit }).toString();
    return request(`/friends/recommendations?${query}`);
  },
  getFriendProfile(friendId) {
    return request(`/friends/${friendId}/profile`);
  },
  deleteFriend(friendId) {
    return request(`/friends/${friendId}`, { method: 'DELETE' });
  },
  getLifeMapInsight(signal) {
    return request('/ai/life-map', { signal });
  },
  chatMemory(message, history, signal) {
    return request('/ai/chat', { method: 'POST', body: JSON.stringify({ message, history }), signal });
  },
  getDiary(id, signal) {
    return request(`/diaries/${encodeURIComponent(id)}`, { signal });
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
  deleteAdminUser(id) {
    return request(`/admin/users/${id}`, { method: 'DELETE' });
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
  updateAvatar(formData) {
    return request('/users/me/avatar', {
      method: 'PATCH',
      body: formData
    });
  },
  deleteAvatar() {
    return request('/users/me/avatar', { method: 'DELETE' });
  },
  deleteAccount(payload) {
    return request('/users/me', {
      method: 'DELETE',
      body: JSON.stringify(payload)
    });
  }
};
