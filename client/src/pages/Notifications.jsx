import { AlertTriangle, Bell, CheckCheck, Package, Truck } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationsContext';

export default function Notifications() {
  const { user } = useAuth();
  const { notifications, loading, unreadCount, markRead, markAllRead } = useNotifications();
  const [filter, setFilter] = useState('all');

  const getTypeIcon = (type) => {
    switch (type) {
      case 'order_status':
        return <Package className="h-5 w-5" />;
      case 'low_stock':
        return <AlertTriangle className="h-5 w-5" />;
      case 'supply_arrival':
        return <Truck className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getTone = (type) => {
    switch (type) {
      case 'low_stock':
        return {
          card: 'border-red-100 bg-red-50/80 dark:border-red-500/20 dark:bg-red-500/10',
          icon: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300',
          badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
          label: 'Низький запас',
        };
      case 'order_status':
        return {
          card: 'border-blue-100 bg-blue-50/70 dark:border-blue-500/20 dark:bg-blue-500/10',
          icon: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
          badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
          label: 'Замовлення',
        };
      case 'supply_arrival':
        return {
          card: 'border-emerald-100 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10',
          icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
          badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
          label: 'Постачання',
        };
      default:
        return {
          card: 'border-slate-200 bg-white/80 dark:border-white/10 dark:bg-slate-900/70',
          icon: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
          badge: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300',
          label: 'Система',
        };
    }
  };

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'unread') return !item.is_read;
    if (filter === 'read') return item.is_read;
    return true;
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-white/50 bg-white/70 p-10 text-center shadow-xl shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <Bell className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Сповіщення</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Увійдіть у свій акаунт, щоб бачити повідомлення про статус замовлень і низький запас на складі.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">Signal Center</p>
          <h1 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">Сповіщення</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Червоні картки означають, що товар просів нижче порогу запасу і потребує уваги.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
            type="button"
          >
            <CheckCheck className="h-4 w-4" />
            Позначити всі як прочитані
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {['all', 'unread', 'read'].map((current) => (
          <button
            key={current}
            onClick={() => setFilter(current)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              filter === current
                ? 'bg-slate-950 text-white dark:bg-amber-400 dark:text-slate-950'
                : 'border border-white/50 bg-white/60 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900'
            }`}
            type="button"
          >
            {current === 'all' ? 'Усі' : current === 'unread' ? `Нові (${unreadCount})` : 'Прочитані'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-[2rem] border border-white/50 bg-white/70 p-10 text-center text-slate-500 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-400">
          Завантаження сповіщень...
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-amber-200 bg-white/70 p-10 text-center shadow-lg shadow-amber-100/30 backdrop-blur dark:border-amber-500/20 dark:bg-slate-900/60 dark:shadow-none">
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {filter === 'unread' ? 'Немає нових повідомлень' : 'Список сповіщень порожній'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotifications.map((notification) => {
            const tone = getTone(notification.type);
            return (
              <div
                key={notification.id}
                className={`rounded-[1.75rem] border p-5 shadow-lg shadow-black/5 transition hover:-translate-y-0.5 dark:shadow-none ${tone.card} ${!notification.is_read ? 'ring-1 ring-inset ring-white/60 dark:ring-white/10' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}>
                    {getTypeIcon(notification.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${tone.badge}`}>
                        {tone.label}
                      </span>
                      {!notification.is_read && <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />}
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{notification.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{notification.message}</p>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {new Date(notification.created_at).toLocaleString('uk-UA')}
                      </p>
                      {!notification.is_read && (
                        <button
                          onClick={() => markRead(notification.id)}
                          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                          type="button"
                        >
                          Позначити як прочитане
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
