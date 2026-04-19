import { ShieldCheck, ShoppingBag, Warehouse } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api';
import OrderChatWindow from '../components/OrderChatWindow';
import { useAuth } from '../contexts/AuthContext';
import { getBackofficeLinks, getRoleLabel } from '../utils/roles';
import { mapZodErrors, normalizePhoneInput, profileSchema } from '../utils/validation';

const formatPrice = (price) => new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
}).format(price || 0);

const ORDER_STATUS_LABELS = {
  new: 'Нове',
  processing: 'В обробці',
  shipped: 'Відправлено',
  delivered: 'Доставлено',
  picked_up: 'Забрано',
  cancelled: 'Скасовано',
  refunded: 'Повернено',
};

export default function Profile() {
  const { userId } = useParams();
  const isPublicView = Boolean(userId);
  const [searchParams] = useSearchParams();
  const { user, loading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [ordersInfo, setOrdersInfo] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [publicProfile, setPublicProfile] = useState(null);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState('');
  const [openedOrderId, setOpenedOrderId] = useState(null);
  const [orderMessages, setOrderMessages] = useState({});
  const [messageDrafts, setMessageDrafts] = useState({});
  const [loadingMessages, setLoadingMessages] = useState({});
  const [sendingMessages, setSendingMessages] = useState({});
  const [cancellingOrders, setCancellingOrders] = useState({});
  const fetchedRef = useRef(false);
  const backofficeLinks = getBackofficeLinks(user?.role);

  const normalizePhone = (value) => {
    return normalizePhoneInput(value);
  };

  useEffect(() => {
    if (!isPublicView) return;
    const fetchPublicProfile = async () => {
      try {
        setPublicLoading(true);
        setPublicError('');
        const response = await api.get(`/api/users/${userId}/public`);
        setPublicProfile(response.data);
      } catch (error) {
        setPublicError(error?.response?.status === 404 ? 'Профіль користувача не знайдено.' : 'Не вдалося завантажити профіль користувача.');
      } finally {
        setPublicLoading(false);
      }
    };
    fetchPublicProfile();
  }, [isPublicView, userId]);

  useEffect(() => {
    if (isPublicView) return;
    const fetchOrders = async () => {
      if (!user || !user.token || fetchedRef.current) {
        return;
      }
      fetchedRef.current = true;
      try {
        setLoadingOrders(true);
        const response = await api.get('/api/orders');
        const ordersData = response.data;
        const validOrders = Array.isArray(ordersData) 
          ? ordersData.filter(o => o && o.id)
          : [];
        setOrders(validOrders);
      } catch (error) {
        console.error('Error fetching orders:', error);
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    };

    fetchOrders();
  }, [isPublicView, user]);

  useEffect(() => {
    if (isPublicView) return;
    if (!user) {
      fetchedRef.current = false;
    }
  }, [isPublicView, user]);

  useEffect(() => {
    if (isPublicView) return;
    const orderId = Number(searchParams.get('order_id') || 0);
    if (!orderId || !orders.length) return;
    const matched = orders.find((order) => order.id === orderId);
    if (!matched) return;
    if (openedOrderId !== matched.id) {
      setOpenedOrderId(matched.id);
      loadOrderMessages(matched.id);
    }
  }, [isPublicView, orders, searchParams, openedOrderId]);

  useEffect(() => {
    if (isPublicView) return;
    setPhoneInput(user?.phone || '');
  }, [isPublicView, user?.phone]);

  if (isPublicView) {
    if (publicLoading) {
      return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-white/50 bg-white/70 p-10 text-center text-slate-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-400">
            Завантаження профілю...
          </div>
        </div>
      );
    }

    if (!publicProfile) {
      return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-white/50 bg-white/70 p-10 text-center text-slate-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-400">
            {publicError || 'Профіль недоступний.'}
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">Публічний профіль</p>
          <h1 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">
            {publicProfile.first_name} {publicProfile.last_name}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Роль: {getRoleLabel(publicProfile.role)} • Відгуків: {publicProfile.reviews_count}
          </p>
        </div>

        <div className="rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Останні відгуки</h2>
          <div className="mt-5 space-y-3">
            {!publicProfile.recent_reviews?.length ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                Користувач ще не залишав відгуків.
              </div>
            ) : publicProfile.recent_reviews.map((review) => (
              <div key={review.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link to={`/product/${review.product?.id}`} className="font-semibold text-slate-900 hover:text-amber-600 dark:text-white dark:hover:text-amber-300">
                    {review.product?.name || 'Товар'}
                  </Link>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Оцінка: {review.rating}/5</span>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{review.comment}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-white/50 bg-white/70 p-10 text-center text-slate-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-400">
          Завантаження...
        </div>
      </div>
    );
  }

  const sortedOrders = [...orders].sort((a, b) => {
    const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });
  const visibleOrders = showAllOrders ? sortedOrders : sortedOrders.slice(0, 3);
  const hasMoreThanThree = sortedOrders.length > 3;
  const activeChatOrder = orders.find((order) => order.id === openedOrderId) || null;
  const isAdmin = user?.role === 'admin';

  const savePhone = async () => {
    if (phoneSaving) return;
    const normalized = normalizePhone(phoneInput);
    const parsed = profileSchema.safeParse({ phone: normalized });
    if (!parsed.success) {
      const mapped = mapZodErrors(parsed.error);
      setProfileMessage(mapped.phone || 'Некоректний номер телефону');
      return;
    }

    try {
      setPhoneSaving(true);
      setProfileMessage('');
      await api.patch('/api/me', { phone: normalized || '' });
      await refreshUser?.();
      setProfileMessage(normalized ? 'Телефон успішно прив\'язано до профілю.' : 'Телефон прибрано з профілю.');
    } catch (error) {
      const message = error?.response?.data?.detail?.message || error?.response?.data?.detail || 'Не вдалося зберегти телефон';
      setProfileMessage(String(message));
    } finally {
      setPhoneSaving(false);
    }
  };

  const canCancelOrder = (status) => ['new', 'processing'].includes(status);

  const loadOrderMessages = async (orderId) => {
    setLoadingMessages((prev) => ({ ...prev, [orderId]: true }));
    try {
      const response = await api.get(`/api/orders/${orderId}/messages`);
      setOrderMessages((prev) => ({ ...prev, [orderId]: response.data?.messages || [] }));
    } catch (error) {
      setOrdersInfo(error?.response?.data?.detail?.message || 'Не вдалося завантажити чат замовлення.');
    } finally {
      setLoadingMessages((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const sendOrderMessage = async (orderId) => {
    const body = String(messageDrafts[orderId] || '').trim();
    if (body.length < 2) {
      setOrdersInfo('Повідомлення має містити щонайменше 2 символи.');
      return;
    }
    setSendingMessages((prev) => ({ ...prev, [orderId]: true }));
    try {
      const response = await api.post(`/api/orders/${orderId}/messages`, { body });
      setOrderMessages((prev) => ({ ...prev, [orderId]: [...(prev[orderId] || []), response.data] }));
      setMessageDrafts((prev) => ({ ...prev, [orderId]: '' }));
      setOrdersInfo('Повідомлення надіслано менеджеру з продажів.');
    } catch (error) {
      setOrdersInfo(error?.response?.data?.detail?.message || 'Не вдалося надіслати повідомлення.');
    } finally {
      setSendingMessages((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const cancelOrder = async (orderId) => {
    if (cancellingOrders[orderId]) return;
    setCancellingOrders((prev) => ({ ...prev, [orderId]: true }));
    try {
      await api.post(`/api/orders/${orderId}/cancel`, { reason: 'Скасовано клієнтом з профілю' });
      setOrdersInfo(`Замовлення #${orderId} успішно скасовано.`);
      await Promise.all([api.get('/api/orders').then((res) => setOrders(Array.isArray(res.data) ? res.data.filter((o) => o && o.id) : [])), loadOrderMessages(orderId)]);
      window.dispatchEvent(new Event('buildshop:notifications-refresh'));
    } catch (error) {
      setOrdersInfo(error?.response?.data?.detail?.message || 'Скасування недоступне для цього замовлення.');
    } finally {
      setCancellingOrders((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">Центр облікового запису</p>
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
                {getRoleLabel(user?.role)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Телефон</p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+380XXXXXXXXX"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={savePhone}
                  disabled={phoneSaving}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
                >
                  {phoneSaving ? 'Збереження...' : 'Зберегти'}
                </button>
              </div>
              {profileMessage ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{profileMessage}</p> : null}
            </div>
          </div>

          {backofficeLinks.length > 0 && (
            <div className="mt-8 border-t border-slate-200 pt-6 dark:border-white/10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Робочі панелі</h3>
              <div className="mt-4 flex flex-wrap gap-3">
                {backofficeLinks.map((link) => (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${link.path === '/admin'
                      ? 'bg-slate-950 text-white hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5'
                    }`}
                    type="button"
                  >
                    {link.path === '/admin' ? <ShieldCheck className="h-4 w-4" /> : <Warehouse className="h-4 w-4" />}
                    {link.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Мої замовлення</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Останні оформлені покупки у вашому акаунті.</p>
              </div>
            </div>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => navigate('/admin/orders')}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
              >
                Перейти до адмін-замовлень
              </button>
            ) : null}
          </div>

          {orders.length > 0 && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              {showAllOrders
                ? `Показано всі замовлення: ${sortedOrders.length}.`
                : `Показано останні 3 замовлення із ${sortedOrders.length}.`}
            </div>
          )}

          {ordersInfo ? (
            <p className="mb-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-white/10 dark:text-slate-200">
              {ordersInfo}
            </p>
          ) : null}

          {loadingOrders ? (
            <div className="rounded-[1.75rem] border border-dashed border-amber-200 p-8 text-center text-slate-500 dark:border-amber-500/20 dark:text-slate-400">
              Завантаження замовлень...
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-amber-200 p-8 text-center text-slate-500 dark:border-amber-500/20 dark:text-slate-400">
              Поки що замовлень немає.
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {visibleOrders.filter(o => o && o.id).map((order) => (
                <div key={order.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Замовлення</p>
                      <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">#{order.id}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      {ORDER_STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <span>{order.created_at ? new Date(order.created_at).toLocaleDateString('uk-UA') : '-'}</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{formatPrice(order.total)}</span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-white/70 p-4 dark:bg-white/5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Склад замовлення</p>
                    {(order.items || []).length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Позиції замовлення недоступні.</p>
                    ) : (
                      <div className="space-y-2">
                        {(order.items || []).map((item) => (
                          <div key={`${order.id}-${item.id || item.product_id}-${item.product_name}`} className="flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
                            <span className="truncate">{item.product_name} x {item.quantity}</span>
                            <span className="shrink-0 font-semibold text-slate-900 dark:text-white">{formatPrice((item.unit_price || 0) * (item.quantity || 0))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        const nextOpened = openedOrderId === order.id ? null : order.id;
                        setOpenedOrderId(nextOpened);
                        if (nextOpened) await loadOrderMessages(order.id);
                      }}
                      className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                    >
                      {openedOrderId === order.id ? 'Закрити чат' : 'Відкрити чат'}
                    </button>
                    {canCancelOrder(order.status) ? (
                      <button
                        type="button"
                        onClick={() => cancelOrder(order.id)}
                        disabled={Boolean(cancellingOrders[order.id])}
                        className="rounded-2xl border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/10"
                      >
                        {cancellingOrders[order.id] ? 'Скасування...' : 'Скасувати замовлення'}
                      </button>
                    ) : null}
                  </div>
                </div>
                ))}
              </div>

              {hasMoreThanThree && (
                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAllOrders((prev) => {
                        const next = !prev;
                        setOrdersInfo(next ? 'Відкрито повний список замовлень.' : 'Відображаються лише останні 3 замовлення.');
                        return next;
                      });
                    }}
                    className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                  >
                    {showAllOrders ? 'Показати лише останні 3' : 'Переглянути всі замовлення'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <OrderChatWindow
        open={Boolean(activeChatOrder)}
        title={activeChatOrder ? `Замовлення #${activeChatOrder.id}` : ''}
        subtitle={activeChatOrder ? `${ORDER_STATUS_LABELS[activeChatOrder.status] || activeChatOrder.status} • ${formatPrice(activeChatOrder.total)}` : ''}
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
          sendOrderMessage(activeChatOrder.id);
        }}
        onClose={() => setOpenedOrderId(null)}
        senderLabel="Ви"
        staffLabel="Менеджер продажів"
        inputPlaceholder="Напишіть питання по доставці або скасуванню..."
        sendLabel="Надіслати менеджеру"
        emptyLabel="Поки що без повідомлень. Ви можете написати менеджеру."
      />
    </div>
  );
}
