import axios from 'axios';
import { clientEnv } from './shared/config/env';

// Access token is stored in-memory for improved security. Refresh token is stored in an HttpOnly cookie.
const AUTH_TOKEN_KEY = 'auth_token'; // kept for compatibility only

const getApiBaseUrl = () => {
  if (clientEnv.apiBaseUrl) {
    return clientEnv.apiBaseUrl;
  }

  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return '/';
  }

  if (typeof window !== 'undefined' && window.location) {
    return '/api';
  }

  return '/';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  withCredentials: true,
});

// Keep token in memory; use refresh cookie to obtain new access tokens
let inMemoryAuthToken = null;
let refreshInProgress = null;

const applyAuthHeader = (token) => {
  if (token) {
    inMemoryAuthToken = token;
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    inMemoryAuthToken = null;
    delete api.defaults.headers.common.Authorization;
  }
};

export const setAuthToken = (token) => {
  const safeToken = String(token || '').trim();
  if (!safeToken) return;
  applyAuthHeader(safeToken);
};

export const clearAuthToken = () => {
  applyAuthHeader(null);
};


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
      const retryDisabledForRequest = config.__disableRetry === true;

      if (retryEnabled && !retryDisabledForRequest && config.__retryCount < MAX_RETRIES) {
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

      if (requestUrl.includes('/api/me')) {
        return Promise.reject(error);
      }

       // Attempt transparent token refresh using HttpOnly refresh cookie
       try {
         if (!refreshInProgress) {
           refreshInProgress = api.post('/token/refresh').then((r) => {
             const newToken = r?.data?.access_token;
             if (newToken) setAuthToken(newToken);
             return newToken;
           }).catch(() => null).finally(() => { refreshInProgress = null; });
         }
         const newToken = await refreshInProgress;
         if (newToken) {
           // retry original request with new token
           config.headers = config.headers || {};
           config.headers.Authorization = `Bearer ${newToken}`;
           return api(config);
         }
        } catch {
          // refresh failed, silently ignore
        }

  // fallback: clear auth silently, do not redirect
        try { localStorage.removeItem('user'); } catch {
          // ignore any errors clearing user data
        }
        clearAuthToken();

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
  const token = inMemoryAuthToken;
  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
