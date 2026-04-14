import api from '../../api';
import { useEffect, useState } from 'react';
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

export default function ManagerOrders({ onUpdate }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/api/orders');
      const ordersData = response.data;
      const validOrders = Array.isArray(ordersData) 
        ? ordersData.filter(o => o && o.id)
        : [];
      setOrders(validOrders);
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

  const filteredOrders = orders.filter((item) => statusFilter === 'all' || item.status === statusFilter);

  return (
    <Panel title="Замовлення" subtitle="Виконання, статуси та деталі кожного кейсу">
      <div className="mb-5 flex flex-wrap gap-2">
        {['all', ...ORDER_STATUS_OPTIONS].map((status) => (
          <FilterButton key={status} active={statusFilter === status} alert={status === 'cancelled'} onClick={() => setStatusFilter(status)}>
            {status === 'all' ? 'Усі' : STATUS_LABELS[status]}
          </FilterButton>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <EmptyState title="Замовлень немає" text="Тут з’являться активні та завершені замовлення." />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div key={order.id} className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-5 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">#{order.id}</h3>
                    <StatusBadge tone={order.status === 'delivered' ? 'emerald' : order.status === 'cancelled' ? 'rose' : 'amber'}>{STATUS_LABELS[order.status] || order.status}</StatusBadge>
                  </div>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    {order.contact_name}, {order.contact_phone} • {order.delivery_address || order.delivery_city || 'без адреси'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button">
                    {selectedOrder?.id === order.id ? 'Сховати' : 'Деталі'}
                  </button>
                  <select
                    value={order.status || 'new'}
                    onChange={async (e) => {
                      await api.put(`/api/orders/${order.id}`, { status: e.target.value });
                      fetchOrders();
                      onUpdate?.();
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm dark:border-white/10 dark:bg-slate-950/60"
                  >
                    {ORDER_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <span>{order.created_at ? new Date(order.created_at).toLocaleString('uk-UA') : '—'}</span>
                <span className="font-semibold text-amber-600 dark:text-amber-300">{order.total || 0}</span>
              </div>

              {selectedOrder?.id === order.id ? (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                  <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Склад замовлення</p>
                  <div className="space-y-2">
                    {(order.items || []).map((item, index) => (
                      <div key={`${order.id}-${index}`} className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                        <span>{item.product_name} x {item.quantity}</span>
                        <span>{(item.unit_price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
