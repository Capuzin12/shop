import { RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState, FilterButton, Panel, StatusBadge } from '../../components/BackofficeUI';

const ORDER_STATUS_OPTIONS = ['new', 'processing', 'shipped', 'delivered', 'cancelled'];
const STATUS_LABELS = {
  new: 'Нове',
  processing: 'В обробці',
  shipped: 'Відправлено',
  delivered: 'Доставлено',
  cancelled: 'Скасовано',
};

export default function AdminOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');

  const auth = { headers: { Authorization: `Bearer ${user?.token}` } };

  const fetchOrders = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/orders', auth);
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    }
  };

  useEffect(() => {
    if (!user?.token) return;
    const loadOrders = async () => {
      await fetchOrders();
    };
    loadOrders();
  }, [user?.token]);

  const filteredOrders = orders.filter((order) => filter === 'all' || order.status === filter);

  return (
    <Panel
      title="Замовлення"
      subtitle="Оновлюйте статуси та контролюйте виконання"
      actions={<button onClick={fetchOrders} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button"><RefreshCcw className="h-4 w-4" />Оновити</button>}
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {['all', ...ORDER_STATUS_OPTIONS].map((status) => (
          <FilterButton key={status} active={filter === status} onClick={() => setFilter(status)} alert={status === 'cancelled'}>
            {status === 'all' ? 'Усі' : STATUS_LABELS[status]}
          </FilterButton>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <EmptyState title="Замовлень не знайдено" text="Спробуйте інший фільтр або дочекайтесь нових замовлень." />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div key={order.id} className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Замовлення #{order.id}</h3>
                    <StatusBadge tone={order.status === 'cancelled' ? 'rose' : order.status === 'delivered' ? 'emerald' : 'amber'}>{STATUS_LABELS[order.status] || order.status}</StatusBadge>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-slate-500 dark:text-slate-400">
                    <p>Клієнт: {order.contact_name || `user #${order.user_id}`}</p>
                    <p>Телефон: {order.contact_phone || '—'}</p>
                    <p>Адреса: {order.delivery_address || order.delivery_city || '—'}</p>
                    <p>Дата: {order.created_at ? new Date(order.created_at).toLocaleString('uk-UA') : '—'}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="text-right text-sm text-slate-500 dark:text-slate-400">
                    <p className="text-xs uppercase tracking-[0.2em]">Сума</p>
                    <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-300">{order.total || 0}</p>
                  </div>
                  <select
                    value={order.status || 'new'}
                    onChange={async (e) => {
                      await axios.put(`http://localhost:8000/api/orders/${order.id}`, { status: e.target.value }, auth);
                      fetchOrders();
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950/60"
                  >
                    {ORDER_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
