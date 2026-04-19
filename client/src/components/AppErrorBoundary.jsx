import React from 'react';
import api, { getLastRequestId } from '../api';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorCode: null,
      reportingFailed: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  async componentDidCatch(error, errorInfo) {
    // Keep a local signal in console; Sentry integration can be added in production.
    console.error('Unhandled UI error:', error, errorInfo);

    const payload = {
      message: String(error?.message || 'Unknown UI error'),
      stack: String(error?.stack || ''),
      component_stack: String(errorInfo?.componentStack || ''),
      path: window.location.pathname,
      user_agent: window.navigator.userAgent,
      request_id: getLastRequestId() || localStorage.getItem('last_request_id'),
      occurred_at: new Date().toISOString(),
    };

    try {
      const response = await api.post('/api/errors', payload, {
        headers: { 'X-Client-Error': 'true' },
      });
      this.setState({ errorCode: response.data?.error_code || null, reportingFailed: false });
    } catch {
      this.setState({ reportingFailed: true, errorCode: null });
    }
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      reportingFailed: false,
      retryCount: prev.retryCount + 1,
    }));
  }

  render() {
    if (this.state.hasError) {
      const customFallback = this.props.fallback?.({
        retry: this.handleRetry,
        errorCode: this.state.errorCode,
        reportingFailed: this.state.reportingFailed,
      });

      if (customFallback) {
        return customFallback;
      }

      return (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="rounded-[1.5rem] border border-rose-200 bg-white/90 p-8 shadow dark:border-rose-500/30 dark:bg-slate-900/80">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Сталася помилка інтерфейсу</h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Спробуйте оновити сторінку. Якщо проблема повторюється, зверніться до підтримки.
            </p>
            {this.state.errorCode ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Код помилки: <span className="font-semibold">{this.state.errorCode}</span>
              </p>
            ) : null}
            {this.state.reportingFailed ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Не вдалося надіслати звіт про помилку на сервер.
              </p>
            ) : null}
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Спробувати знову
              </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950"
            >
              Оновити сторінку
            </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

