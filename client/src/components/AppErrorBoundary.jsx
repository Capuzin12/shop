import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Keep a local signal in console; Sentry integration can be added in production.
    console.error('Unhandled UI error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="rounded-[1.5rem] border border-rose-200 bg-white/90 p-8 shadow dark:border-rose-500/30 dark:bg-slate-900/80">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Сталася помилка інтерфейсу</h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Спробуйте оновити сторінку. Якщо проблема повторюється, зверніться до підтримки.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950"
            >
              Оновити сторінку
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

