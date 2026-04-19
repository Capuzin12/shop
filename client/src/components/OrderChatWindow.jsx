import { X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

export default function OrderChatWindow({
  open,
  title,
  subtitle,
  messages,
  loading,
  sending,
  draft,
  onDraftChange,
  onSend,
  onClose,
  senderLabel = 'Ви',
  staffLabel = 'Менеджер',
  inputPlaceholder = 'Напишіть повідомлення...',
  sendLabel = 'Надіслати',
  emptyLabel = 'Поки що немає повідомлень.',
}) {
  const listRef = useRef(null);
  const messageCount = useMemo(() => (Array.isArray(messages) ? messages.length : 0), [messages]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messageCount, loading]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        onSend?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, onSend]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none md:pointer-events-none">
      <div className="absolute inset-0 bg-slate-950/30 md:bg-transparent" onClick={onClose} />

      <section
        className="pointer-events-auto absolute bottom-0 left-0 right-0 mx-auto flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-white/60 bg-white shadow-2xl shadow-black/20 backdrop-blur dark:border-white/10 dark:bg-slate-950/95 md:bottom-6 md:right-6 md:left-auto md:w-[420px] md:rounded-[2rem]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 dark:border-white/10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">Чат замовлення</p>
            <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-white">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
            aria-label="Закрити чат"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="border-b border-slate-200 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400 dark:border-white/10">
          {senderLabel} ↔ {staffLabel}
        </div>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Завантаження чату...</p>
          ) : messageCount === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              {emptyLabel}
            </p>
          ) : (
            messages.map((message) => {
              const fromStaff = Boolean(message.is_from_staff);
              return (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${fromStaff
                    ? 'ml-0 mr-auto bg-amber-50 text-slate-700 dark:bg-amber-500/10 dark:text-slate-100'
                    : 'ml-auto mr-0 bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-100'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    <span>{fromStaff ? staffLabel : senderLabel}</span>
                    <span>{message.created_at ? new Date(message.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{message.body}</p>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-slate-200 p-4 dark:border-white/10">
          <textarea
            value={draft}
            onChange={(e) => onDraftChange?.(e.target.value)}
            rows={3}
            placeholder={inputPlaceholder}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Ctrl/⌘ + Enter — швидка відправка</p>
            <button
              type="button"
              onClick={onSend}
              disabled={sending}
              className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
            >
              {sending ? 'Надсилання...' : sendLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

