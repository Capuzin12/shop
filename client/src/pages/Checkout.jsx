import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';

const GUEST_CHECKOUT_KEY = 'buildshop-checkout-draft';

const formatPrice = (price) => new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
}).format(price || 0);

const readDraft = () => {
  try {
    const raw = localStorage.getItem(GUEST_CHECKOUT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function Checkout() {
  const { cart, clearCart, getTotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(() => readDraft() || {
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    delivery_city: '',
    delivery_address: '',
    comment: '',
    delivery_method: 'nova_poshta',
    payment_method: 'card',
  });
  const [message, setMessage] = useState('');
  const [inventory, setInventory] = useState({});

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const response = await api.get('/api/inventory');
        const invData = response.data;
        const invMap = {};
        if (Array.isArray(invData)) {
          invData.forEach(item => {
            invMap[item.product_id] = item.quantity;
          });
        }
        setInventory(invMap);
      } catch (error) {
        console.error('Error fetching inventory:', error);
      }
    };
    fetchInventory();
  }, []);

  useEffect(() => {
    localStorage.setItem(GUEST_CHECKOUT_KEY, JSON.stringify(formData));
  }, [formData]);

  const getAvailableQuantity = (productId) => {
    return inventory[productId] ?? 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      setMessage('Чернетку збережено локально. Увійдіть, щоб завершити оформлення замовлення.');
      navigate('/login');
      return;
    }

    const outOfStock = cart.find(item => getAvailableQuantity(item.id) < item.quantity);
    if (outOfStock) {
      setMessage(`Товару "${outOfStock.name}" недостатньо на складі. Доступно: ${getAvailableQuantity(outOfStock.id)}`);
      return;
    }

    try {
      await api.post('/api/orders', {
        ...formData,
        items: cart.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
        })),
      });

      clearCart();
      localStorage.removeItem(GUEST_CHECKOUT_KEY);
      navigate('/profile');
    } catch (error) {
      console.error('Error creating order:', error);
      console.error('Error response:', error.response);
      console.error('Error response data:', error.response?.data);
      console.error('Error response status:', error.response?.status);
      const errorMsg = error.response?.data?.detail;
      if (errorMsg && errorMsg.includes('Not enough stock')) {
        setMessage(`Помилка: недостатньо товару на складі. ${errorMsg}`);
      } else {
        setMessage(`Не вдалося оформити замовлення. Помилка: ${errorMsg || error.message}`);
      }
    }
  };

  if (cart.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">Checkout Draft</p>
        <h1 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">Оформлення замовлення</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Дані форми зберігаються локально, тому навіть без входу ви не втратите введену інформацію.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.05fr,0.95fr]">
        <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Ім'я</span>
              <input value={formData.contact_name} onChange={(e) => setFormData((prev) => ({ ...prev, contact_name: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" required />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Телефон</span>
              <input value={formData.contact_phone} onChange={(e) => setFormData((prev) => ({ ...prev, contact_phone: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" required />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Email</span>
              <input value={formData.contact_email} onChange={(e) => setFormData((prev) => ({ ...prev, contact_email: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Місто</span>
              <input value={formData.delivery_city} onChange={(e) => setFormData((prev) => ({ ...prev, delivery_city: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" required />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Адреса</span>
              <input value={formData.delivery_address} onChange={(e) => setFormData((prev) => ({ ...prev, delivery_address: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" required />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Коментар</span>
              <textarea value={formData.comment} onChange={(e) => setFormData((prev) => ({ ...prev, comment: e.target.value }))} rows="4" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" />
            </label>
          </div>

          {message ? (
            <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {message}
            </p>
          ) : null}

          <button className="mt-6 w-full rounded-2xl bg-slate-950 px-6 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300" type="submit">
            {user ? 'Підтвердити замовлення' : 'Зберегти чернетку і перейти до входу'}
          </button>
        </form>

        <div className="rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Ваше замовлення</h2>
          <div className="mt-5 space-y-3">
            {cart.map((item) => {
              const available = getAvailableQuantity(item.id);
              const isOutOfStock = available < item.quantity;
              return (
                <div key={item.id} className={`flex items-center justify-between rounded-2xl border px-4 py-3 dark:border-white/10 dark:bg-white/5 ${isOutOfStock ? 'border-rose-300 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10' : 'border-slate-200 bg-slate-50'}`}>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {item.quantity} x {formatPrice(item.price)}
                      {available > 0 && available < item.quantity && (
                        <span className="ml-2 text-rose-500"> (в наявності: {available})</span>
                      )}
                      {available === 0 && (
                        <span className="ml-2 text-rose-500"> (немає в наявності)</span>
                      )}
                    </p>
                  </div>
                  <p className="font-bold text-amber-600 dark:text-amber-300">{formatPrice(item.price * item.quantity)}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-[1.75rem] bg-slate-950 p-5 text-white dark:bg-amber-400 dark:text-slate-950">
            <p className="text-xs uppercase tracking-[0.2em] text-white/70 dark:text-slate-800/70">Разом</p>
            <p className="mt-2 text-3xl font-black">{formatPrice(getTotal())}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
