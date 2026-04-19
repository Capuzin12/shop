import api from '../../api';
import { RefreshCcw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState, FilterButton, Panel, StatusBadge } from '../../components/BackofficeUI';
import OrderChatWindow from '../../components/OrderChatWindow';

const ORDER_STATUS_OPTIONS = ['new', 'processing', 'shipped', 'delivered', 'picked_up', 'cancelled'];
const STATUS_LABELS = {
  new: 'Нове',
  processing: 'В обробці',
  shipped: 'Відправлено',
  delivered: 'Доставлено',
  picked_up: 'Забрано',
  cancelled: 'Скасовано',
};

export default function ManagerOrders({ onUpdate }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderMessages, setOrderMessages] = useState({});
  const [messageDrafts, setMessageDrafts] = useState({});
  const [loadingMessages, setLoadingMessages] = useState({});
  const [sendingMessages, setSendingMessages] = useState({});

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

  useEffect(() => {
    const orderId = Number(searchParams.get('order_id') || 0);
    if (!orderId || !orders.length) return;
    const matched = orders.find((order) => order.id === orderId);
    if (!matched) return;
    if (selectedOrder?.id !== matched.id) {
      setSelectedOrder(matched);
      loadMessages(matched.id);
    }
  }, [orders, searchParams, selectedOrder]);

  const loadMessages = async (orderId) => {
    setLoadingMessages((prev) => ({ ...prev, [orderId]: true }));
    try {
      const response = await api.get(`/api/orders/${orderId}/messages`);
      setOrderMessages((prev) => ({ ...prev, [orderId]: response.data?.messages || [] }));
    } catch (error) {
      console.error('Error fetching order messages:', error);
    } finally {
      setLoadingMessages((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const sendMessage = async (orderId) => {
    const body = String(messageDrafts[orderId] || '').trim();
    if (body.length < 2) return;
    setSendingMessages((prev) => ({ ...prev, [orderId]: true }));
    try {
      const response = await api.post(`/api/orders/${orderId}/messages`, { body });
      setOrderMessages((prev) => ({ ...prev, [orderId]: [...(prev[orderId] || []), response.data] }));
      setMessageDrafts((prev) => ({ ...prev, [orderId]: '' }));
    } catch (error) {
      console.error('Error sending order message:', error);
    } finally {
      setSendingMessages((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const activeChatOrder = selectedOrder;

  const updateOrderStatus = async (orderId, status) => {
    await api.put(`/api/orders/${orderId}`, { status });
    window.dispatchEvent(new Event('buildshop:notifications-refresh'));
    await fetchOrders();
    onUpdate?.();
  };

  const statusCounts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  const filteredOrders = orders.filter((item) => {
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    if (!matchesStatus) return false;
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return true;
    const searchable = [
      item.id,
      item.contact_name,
      item.contact_phone,
      item.delivery_address,
      item.delivery_city,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchable.includes(normalized);
  });

  return (
    <Panel
      title="Замовлення"
      subtitle="Виконання, статуси та деталі кожного кейсу"
      actions={(
        <button onClick={fetchOrders} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5" type="button">
          <RefreshCcw className="h-4 w-4" />
          Оновити
        </button>
      )}
    >
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Пошук за ID, клієнтом або телефоном"
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm dark:border-white/10 dark:bg-slate-950/60"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {['all', ...ORDER_STATUS_OPTIONS].map((status) => {
            const count = status === 'all' ? orders.length : (statusCounts[status] || 0);
            return (
              <FilterButton key={status} active={statusFilter === status} alert={status === 'cancelled'} onClick={() => setStatusFilter(status)}>
                {status === 'all' ? `Усі (${count})` : `${STATUS_LABELS[status]} (${count})`}
              </FilterButton>
            );
          })}
        </div>
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
                    <StatusBadge tone={['delivered', 'picked_up'].includes(order.status) ? 'emerald' : order.status === 'cancelled' ? 'rose' : 'amber'}>{STATUS_LABELS[order.status] || order.status}</StatusBadge>
                  </div>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    {order.contact_name}, {order.contact_phone} • {order.delivery_address || order.delivery_city || 'без адреси'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={async () => {
                    const next = selectedOrder?.id === order.id ? null : order;
                    setSelectedOrder(next);
                    if (next) await loadMessages(order.id);
                  }} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button">
                    {selectedOrder?.id === order.id ? 'Сховати' : 'Деталі'}
                  </button>
                  <select
                    value={order.status || 'new'}
                    onChange={async (e) => updateOrderStatus(order.id, e.target.value)}
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

              <div className="mt-4 flex flex-wrap gap-2">
                {order.status === 'new' ? (
                  <button onClick={() => updateOrderStatus(order.id, 'processing')} className="rounded-2xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white" type="button">
                    Взяти в обробку
                  </button>
                ) : null}
                {['processing', 'shipped'].includes(order.status) ? (
                  <button onClick={() => updateOrderStatus(order.id, 'delivered')} className="rounded-2xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white" type="button">
                    Позначити виконаним
                  </button>
                ) : null}
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
      <OrderChatWindow
        open={Boolean(activeChatOrder)}
        title={activeChatOrder ? `Замовлення #${activeChatOrder.id}` : ''}
        subtitle={activeChatOrder ? `${STATUS_LABELS[activeChatOrder.status] || activeChatOrder.status} • ${activeChatOrder.contact_name || 'Покупець'}` : ''}
        messages={activeChatOrder ? (orderMessages[activeChatOrder.id] || []) : []}
        loading={activeChatOrder ? Boolean(loadingMessages[activeChatOrder.id]) : false}
        sending={activeChatOrder ? Boolean(sendingMessages[activeChatOrder.id]) : false}
        draft={activeChatOrder ? (messageDrafts[activeChatOrder.id] || '') : ''}
        onDraftChange={(value) => {
          if (!activeChatOrder) return;
          setMessageDrafts((prev) => ({ ...prev, [activeChatOrder.id]: value }));
        }}
        onSend={() => {
          if (!activeChatOrder) return;
          sendMessage(activeChatOrder.id);
        }}
        onClose={() => setSelectedOrder(null)}
        senderLabel="Покупець"
        staffLabel="Менеджер"
        inputPlaceholder="Відповідь покупцю..."
        sendLabel="Надіслати покупцю"
        emptyLabel="Поки що немає повідомлень."
      />
    </Panel>
  );
}
