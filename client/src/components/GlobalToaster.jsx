import { useEffect, useState } from 'react';

export default function GlobalToaster() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const onToast = (event) => {
      const detail = event?.detail || {};
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const nextToast = {
        id,
        title: detail.title || 'Повідомлення',
        message: detail.message || 'Щось пішло не так',
        level: detail.level || 'warning',
      };

      setToasts((prev) => [...prev, nextToast].slice(-4));

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 4500);
    };

    window.addEventListener('buildshop:toast', onToast);
    return () => window.removeEventListener('buildshop:toast', onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${
            toast.level === 'error'
              ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/70 dark:text-rose-100'
              : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/70 dark:text-amber-100'
          }`}
        >
          <p className="font-semibold">{toast.title}</p>
          <p>{toast.message}</p>
        </div>
      ))}
    </div>
  );
}

