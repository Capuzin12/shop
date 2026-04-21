import axios from 'axios';

const AUTH_TOKEN_KEY = 'auth_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/',
  timeout: 15000,
  withCredentials: true,
});

const getStoredAuthToken = () => {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY) || null;
  } catch {
    return null;
  }
};

const applyAuthHeader = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const setAuthToken = (token, remember = true) => {
  const safeToken = String(token || '').trim();
  if (!safeToken) {
    return;
  }
  try {
    if (remember) {
      localStorage.setItem(AUTH_TOKEN_KEY, safeToken);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    } else {
      sessionStorage.setItem(AUTH_TOKEN_KEY, safeToken);
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // Storage may be unavailable in strict browser privacy modes.
  }
  applyAuthHeader(safeToken);
};

export const clearAuthToken = () => {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // no-op
  }
  applyAuthHeader(null);
};

export const hasStoredAuthToken = () => Boolean(getStoredAuthToken());

// Initialize header from storage for page refresh/reopen flows.
applyAuthHeader(getStoredAuthToken());

const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);
const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Невірний email або пароль.',
  INSUFFICIENT_STOCK: 'Недостатньо товару на складі для виконання запиту.',
  INVALID_MESSAGE: 'Повідомлення має некоректний формат.',
  RATE_LIMIT: 'Занадто багато запитів. Спробуйте пізніше.',
  UNAUTHORIZED: 'Потрібно повторно увійти у систему.',
};

let lastRequestId = null;

const dispatchToast = (title, message, level = 'warning') => {
  window.dispatchEvent(new CustomEvent('buildshop:toast', {
    detail: { title, message, level },
  }));
};

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const isAuthEndpointRequest = (url = '') => {
  const normalized = String(url);
  return normalized.includes('/token') || normalized.includes('/api/logout');
};

const resolveErrorCode = (error) => {
  const detail = error?.response?.data?.detail;
  return detail?.code || error?.response?.data?.error_code || null;
};

export const getLastRequestId = () => lastRequestId;

export const getFriendlyErrorMessage = (error) => {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;
  const code = resolveErrorCode(error);

  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (status === 401) return ERROR_MESSAGES.UNAUTHORIZED;
  if (status === 429) return ERROR_MESSAGES.RATE_LIMIT;
  if (typeof detail === 'string') return detail;
  if (detail?.message) return detail.message;
  return 'Сталася помилка. Спробуйте ще раз.';
};

api.interceptors.response.use(
  (response) => {
    const requestId = response.headers?.['x-request-id'];
    if (requestId) {
      lastRequestId = requestId;
      localStorage.setItem('last_request_id', requestId);
    }
    return response;
  },
  async (error) => {
    const status = error?.response?.status;
    const config = error?.config || {};
    const requestUrl = config?.url || '';

    const requestId = error?.response?.headers?.['x-request-id'];
    if (requestId) {
      lastRequestId = requestId;
      localStorage.setItem('last_request_id', requestId);
    }

    if (status && RETRYABLE_STATUSES.has(status)) {
      config.__retryCount = config.__retryCount || 0;
      const retryEnabled = localStorage.getItem('feature:apiRetryFor5xx') !== 'false';

      if (retryEnabled && config.__retryCount < MAX_RETRIES) {
        config.__retryCount += 1;
        const delayMs = 300 * (2 ** (config.__retryCount - 1));
        await wait(delayMs);
        return api(config);
      }
    }

    if (status === 401) {
      if (isAuthEndpointRequest(requestUrl)) {
        return Promise.reject(error);
      }

      localStorage.removeItem('user');
      clearAuthToken();

      // Avoid full reload loop when user is already on login page.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }

      return Promise.reject(error);
    }

    const message = getFriendlyErrorMessage(error);
    const recoverable = status === 408 || status === 429 || (status && status >= 500);
    if (recoverable) {
      dispatchToast('Тимчасова помилка', message, 'warning');
    }

    return Promise.reject(error);
  }
);

api.interceptors.request.use((config) => {
  const token = getStoredAuthToken();
  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
