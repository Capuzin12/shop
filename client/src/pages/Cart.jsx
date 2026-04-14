import { Link } from 'react-router-dom';
import { Heart, RefreshCcw, ShoppingBag, Trash2, Plus, Minus } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../api';
import { useCart } from '../contexts/CartContext';

const formatPrice = (price) => new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
}).format(price || 0);

export default function Cart() {
  const { cart, removeFromCart, updateQuantity, getTotal } = useCart();
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

  const getAvailableQuantity = (productId) => {
    return inventory[productId] ?? 0;
  };

  const handleUpdateQuantity = (productId, newQuantity) => {
    const available = getAvailableQuantity(productId);
    if (available > 0 && newQuantity > available) {
      updateQuantity(productId, available);
    } else if (newQuantity > 0) {
      updateQuantity(productId, newQuantity);
    }
  };

  if (!cart || cart.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">Shopping Cart</p>
          <h1 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">Кошик</h1>
        </div>

        <div className="rounded-[2rem] border border-dashed border-amber-200 bg-white/70 p-12 text-center shadow-lg shadow-amber-100/30 backdrop-blur dark:border-amber-500/20 dark:bg-slate-900/60 dark:shadow-none">
          <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ваш кошик порожній</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Додайте товари з каталогу, щоб оформити замовлення.</p>
          <Link to="/catalog" className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300">
            Перейти до каталогу
          </Link>
        </div>
      </div>
    );
  }

  const hasOutOfStock = cart.some(item => getAvailableQuantity(item.id) === 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">Shopping Cart</p>
          <h1 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">Кошик</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Перегляньте обрані товари перед оформленням замовлення.
          </p>
        </div>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {cart.length} товар{cart.length === 1 ? '' : cart.length > 1 && cart.length < 5 ? 'и' : 'ів'} у кошику
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cart.map((item) => (
          <div key={item.id} className="group rounded-[2rem] border border-white/50 bg-white/80 p-5 shadow-lg shadow-amber-100/30 transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-slate-900/70 dark:shadow-none">
            <div className="mb-5 rounded-[1.5rem] bg-[linear-gradient(135deg,#ffe9d2,_#fff7ef)] p-6 dark:bg-[linear-gradient(135deg,#2b231d,_#18181f)]">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                <span>{item.sku || 'BuildShop'}</span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-amber-700 dark:bg-white/10 dark:text-amber-300">Cart</span>
              </div>
              <h2 className="mt-8 min-h-[72px] text-2xl font-bold text-slate-900 dark:text-white">
                {item.name || 'Товар'}
              </h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ціна</p>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-300">
                    {formatPrice(item.price)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/60">
                <button
                  onClick={() => handleUpdateQuantity(item.id, (item.quantity || 1) - 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                  type="button"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="text-center">
                  <span className="text-lg font-semibold text-slate-900 dark:text-white">
                    {item.quantity || 1}
                  </span>
                  {getAvailableQuantity(item.id) > 0 && getAvailableQuantity(item.id) < 10 && (
                    <p className="text-xs text-amber-600 dark:text-amber-300">в наявності: {getAvailableQuantity(item.id)}</p>
                  )}
                </div>
                <button
                  onClick={() => handleUpdateQuantity(item.id, (item.quantity || 1) + 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-end justify-between rounded-2xl bg-slate-100 p-4 dark:bg-slate-950/60">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Сума</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {formatPrice(item.price * (item.quantity || 1))}
                  </p>
                </div>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  Видалити
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasOutOfStock && (
        <div className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          Деякі товари закінчилися на складі. Будь ласка, видаліть їх або зменшіть кількість.
        </div>
      )}

      <div className="mt-8 rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Загальна сума</p>
            <p className="text-3xl font-black text-amber-600 dark:text-amber-300">
              {formatPrice(getTotal())}
            </p>
          </div>
          <Link
            to={hasOutOfStock ? "#" : "/checkout"}
            onClick={(e) => {
              if (hasOutOfStock) {
                e.preventDefault();
              }
            }}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-4 text-base font-semibold transition ${
              hasOutOfStock
                ? 'cursor-not-allowed bg-slate-300 text-slate-500 dark:bg-slate-700 dark:text-slate-500'
                : 'bg-slate-950 text-white hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300'
            }`}
          >
            <ShoppingBag className="h-5 w-5" />
            Оформити замовлення
          </Link>
        </div>
      </div>
    </div>
  );
}
