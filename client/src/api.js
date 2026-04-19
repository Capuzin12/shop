import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/',
  timeout: 15000,
});

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

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Redirect to login page
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

export default api;
