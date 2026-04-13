import { ShieldCheck, ShoppingBag, Warehouse } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

const formatPrice = (price) => new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
}).format(price || 0);

export default function Profile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user || !user.token) {
        return;
      }
      try {
        setLoadingOrders(true);
        const response = await api.get('/api/orders');
        setOrders(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error('Error fetching orders:', error);
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    };

    fetchOrders();
  }, [user]);

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-white/50 bg-white/70 p-10 text-center text-slate-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-400">
          Завантаження...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">Account Center</p>
        <h1 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">Профіль</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.9fr,1.1fr]">
        <div className="rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Особисті дані</h2>
          <div className="mt-5 space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Email</p>
              <p className="mt-2 font-semibold text-slate-900 dark:text-white">{user?.email}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Роль</p>
              <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                {user?.role === 'admin' ? 'Адміністратор' : user?.role === 'manager' ? 'Менеджер' : 'Клієнт'}
              </p>
            </div>
          </div>

          {(user?.role === 'admin' || user?.role === 'manager') && (
            <div className="mt-8 border-t border-slate-200 pt-6 dark:border-white/10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Робочі панелі</h3>
              <div className="mt-4 flex flex-wrap gap-3">
                {user?.role === 'admin' && (
                  <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300" type="button">
                    <ShieldCheck className="h-4 w-4" />
                    Панель адміністратора
                  </button>
                )}
                <button onClick={() => navigate('/manager')} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5" type="button">
                  <Warehouse className="h-4 w-4" />
                  Панель менеджера
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <div className="mb-5 flex items-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Мої замовлення</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Останні оформлені покупки у вашому акаунті.</p>
            </div>
          </div>

          {loadingOrders ? (
            <div className="rounded-[1.75rem] border border-dashed border-amber-200 p-8 text-center text-slate-500 dark:border-amber-500/20 dark:text-slate-400">
              Завантаження замовлень...
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-amber-200 p-8 text-center text-slate-500 dark:border-amber-500/20 dark:text-slate-400">
              Поки що замовлень немає.
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Замовлення</p>
                      <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">#{order.id}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      {order.status}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <span>{order.created_at ? new Date(order.created_at).toLocaleDateString('uk-UA') : '-'}</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{formatPrice(order.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
