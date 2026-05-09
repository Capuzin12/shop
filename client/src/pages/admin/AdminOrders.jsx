import api from '../../api';
import { RefreshCcw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState, FilterButton, LoadingState, Panel, StatusBadge } from '../../components/BackofficeUI';
import OrderChatWindow from '../../components/OrderChatWindow';

const ORDER_STATUS_OPTIONS = ['new', 'processing', 'shipped', 'delivered', 'picked_up', 'cancelled', 'refunded'];
const STATUS_LABELS = {
  new: 'Нове',
  processing: 'В обробці',
  shipped: 'Відправлено',
  delivered: 'Доставлено',
  picked_up: 'Забрано',
  cancelled: 'Скасовано',
  refunded: 'Повернено',
};

const ORDER_STATUS_FLOW = {
  new: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'picked_up'],
  delivered: ['refunded'],
  picked_up: ['refunded'],
  cancelled: [],
  refunded: [],
};

export default function AdminOrders() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderMessages, setOrderMessages] = useState({});
  const [messageDrafts, setMessageDrafts] = useState({});
  const [loadingMessages, setLoadingMessages] = useState({});
  const [sendingMessages, setSendingMessages] = useState({});
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const getAllowedStatuses = (currentStatus) => {
    const normalized = currentStatus || 'new';
    return [normalized, ...(ORDER_STATUS_FLOW[normalized] || [])];
  };

  const extractApiMessage = (error, fallback) => {
    const detail = error?.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (detail?.message) return detail.message;
    return fallback;
  };

  const fetchOrders = async ({ showLoading = true } = {}) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await api.get('/api/admin/orders');
      const ordersData = response.data;
      const validOrders = Array.isArray(ordersData) 
        ? ordersData.filter(o => o && o.id)
        : [];
      setOrders(validOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const loadOrders = async () => {
      await fetchOrders();
    };
    loadOrders();
  }, [user]);

  const clearOrderQueryParam = () => {
    if (!searchParams.get('order_id')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('order_id');
    setSearchParams(next, { replace: true });
  };

  const loadMessages = async (orderId) => {
    setLoadingMessages((prev) => ({ ...prev, [orderId]: true }));
    try {
      const response = await api.get(`/api/orders/${orderId}/messages`, { params: { limit: 100 } });
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

  useEffect(() => {
    const orderId = Number(searchParams.get('order_id') || 0);
    if (!orderId || !orders.length) return;
    const matched = orders.find((order) => order.id === orderId);
    if (!matched) return;
    if (selectedOrder?.id !== matched.id) {
      setSelectedOrder(matched);
      loadMessages(matched.id);
      clearOrderQueryParam();
    }
  }, [orders, searchParams, selectedOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusCounts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = filter === 'all' || order.status === filter;
    if (!matchesStatus) return false;
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return true;
    const searchable = [order.id, order.contact_name, order.contact_phone, order.delivery_address, order.delivery_city]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchable.includes(normalized);
  });

  return (
    <Panel
      title="Замовлення"
      subtitle="Оновлюйте статуси та контролюйте виконання"
      actions={<button onClick={() => fetchOrders()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button"><RefreshCcw className="h-4 w-4" />Оновити</button>}
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
              <FilterButton key={status} active={filter === status} onClick={() => setFilter(status)} alert={status === 'cancelled'}>
                {status === 'all' ? `Усі (${count})` : `${STATUS_LABELS[status]} (${count})`}
              </FilterButton>
            );
          })}
        </div>
      </div>

      {actionMessage ? (
        <p className="mb-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-white/10 dark:text-slate-200">
          {actionMessage}
        </p>
      ) : null}

      {isLoading ? (
        <LoadingState />
      ) : filteredOrders.length === 0 ? (
        <EmptyState title="Замовлень не знайдено" text="Спробуйте інший фільтр або дочекайтесь нових замовлень." />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div key={order.id} className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Замовлення #{order.id}</h3>
                    <StatusBadge tone={order.status === 'cancelled' ? 'rose' : order.status === 'refunded' ? 'blue' : ['delivered', 'picked_up'].includes(order.status) ? 'emerald' : 'amber'}>{STATUS_LABELS[order.status] || order.status}</StatusBadge>
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
                  <button
                    type="button"
                    onClick={async () => {
                      const next = selectedOrder?.id === order.id ? null : order;
                      setSelectedOrder(next);
                      if (!next) clearOrderQueryParam();
                      if (next) await loadMessages(order.id);
                    }}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                  >
                    {selectedOrder?.id === order.id ? 'Закрити чат' : 'Відкрити чат'}
                  </button>
                  <select
                    value={order.status || 'new'}
                    onChange={async (e) => {
                      const nextStatus = e.target.value;
                      const currentStatus = order.status || 'new';
                      if (nextStatus === currentStatus) return;

                      try {
                        setUpdatingOrderId(order.id);
                        setActionMessage('');
                        await api.put(`/api/orders/${order.id}`, { status: nextStatus });
                        window.dispatchEvent(new Event('buildshop:notifications-refresh'));
                        await fetchOrders({ showLoading: false });
                        setActionMessage(`Статус замовлення #${order.id} оновлено: ${STATUS_LABELS[nextStatus] || nextStatus}.`);
                      } catch (error) {
                        setActionMessage(extractApiMessage(error, `Не вдалося змінити статус замовлення #${order.id}.`));
                      } finally {
                        setUpdatingOrderId(null);
                      }
                    }}
                    disabled={updatingOrderId === order.id}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950/60"
                  >
                    {getAllowedStatuses(order.status).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <OrderChatWindow
        open={Boolean(selectedOrder)}
        title={selectedOrder ? `Замовлення #${selectedOrder.id}` : ''}
        subtitle={selectedOrder ? `${STATUS_LABELS[selectedOrder.status] || selectedOrder.status} • ${selectedOrder.contact_name || 'Покупець'}` : ''}
        messages={selectedOrder ? (orderMessages[selectedOrder.id] || []) : []}
        loading={selectedOrder ? Boolean(loadingMessages[selectedOrder.id]) : false}
        sending={selectedOrder ? Boolean(sendingMessages[selectedOrder.id]) : false}
        draft={selectedOrder ? (messageDrafts[selectedOrder.id] || '') : ''}
        onDraftChange={(value) => {
          if (!selectedOrder) return;
          setMessageDrafts((prev) => ({ ...prev, [selectedOrder.id]: value }));
        }}
        onSend={() => {
          if (!selectedOrder) return;
          sendMessage(selectedOrder.id);
        }}
        onClose={() => {
          setSelectedOrder(null);
          clearOrderQueryParam();
        }}
        senderLabel="Покупець"
        staffLabel="Адмін"
        inputPlaceholder="Відповідь покупцю..."
        sendLabel="Надіслати покупцю"
        emptyLabel="Поки що немає повідомлень."
      />
    </Panel>
  );
}
