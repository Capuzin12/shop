import { Link } from 'react-router-dom';
import { ShoppingBag, Trash2, Plus, Minus } from 'lucide-react';
import { useMemo } from 'react';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../../../shared/utils/format';

const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return url;
  return `/${url}`;
};

const getStockQuantity = (item) => {
  if (typeof item?.stock_quantity === 'number') return item.stock_quantity;
  if (typeof item?.in_stock === 'boolean') return item.in_stock ? item.quantity || 0 : 0;
  return null;
};

export default function Cart() {
  const { cart, removeFromCart, updateQuantity } = useCart();
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

  const handleUpdateQuantity = (item, newQuantity) => {
    const available = getStockQuantity(item);
    if (typeof available === 'number' && available >= 0 && newQuantity > available) {
      updateQuantity(item.id, available);
    } else if (newQuantity > 0) {
      updateQuantity(item.id, newQuantity);
    }
  };

  if (!cart || cart.length === 0) {
    return (
        <div className="page-shell">
          <div className="mb-6 rounded-2xl border border-white/50 bg-white/75 p-5 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-300">Кошик</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Ваш кошик</h1>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-10 text-center dark:border-white/10 dark:bg-slate-900/40">
            <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Кошик порожній</p>
            <p className="mt-1 text-xs text-slate-400">Додайте товари з каталогу</p>
            <Link to="/catalog" className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950">
              До каталогу
            </Link>
          </div>
        </div>
    );
  }

  const hasOutOfStock = cart.some((item) => {
    const available = getStockQuantity(item);
    return typeof available === 'number' && available >= 0 && available < item.quantity;
  });

    const hasInvalidPrice = cart.some((item) => item.price === null || item.price === undefined);

  return (
      <div className="page-shell">
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-white/50 bg-white/75 px-5 py-4 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-300">Кошик</p>
            <h1 className="mt-0.5 text-2xl font-black text-slate-900 dark:text-white">Ваші товари</h1>
          </div>
          <span className="text-xs text-slate-400">{cart.length} позиц{cart.length === 1 ? 'ія' : cart.length < 5 ? 'ії' : 'ій'}</span>
        </div>
        <div className="space-y-3">
          {cart.map((item) => {
            const available = getStockQuantity(item);
            const isOutOfStock = typeof available === 'number' && available >= 0 && available < item.quantity;
            return (
                <div key={item.id} className={`flex items-center gap-4 rounded-2xl border bg-white/80 px-4 py-3 dark:bg-slate-900/60 ${isOutOfStock ? 'border-rose-200 dark:border-rose-500/20' : 'border-white/50 dark:border-white/10'}`}>
                  {item.image_url ? (
                      <div className="h-14 w-14 flex-none overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                        <img src={getImageUrl(item.image_url)} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                      </div>
                  ) : (
                      <div className="h-14 w-14 flex-none rounded-xl bg-slate-100 dark:bg-slate-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.name}</p>
                    <p className="text-xs text-slate-400">{item.sku}</p>
                    {isOutOfStock && (
                        <p className="mt-0.5 text-xs text-rose-500">Недостатньо на складі</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-white/10">
                    <button onClick={() => handleUpdateQuantity(item, (item.quantity || 1) - 1)} className="flex h-8 w-8 items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" type="button">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="min-w-6 text-center text-sm font-medium text-slate-900 dark:text-white">{item.quantity}</span>
                    <button onClick={() => handleUpdateQuantity(item, (item.quantity || 1) + 1)} className="flex h-8 w-8 items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" type="button">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                    <div className="text-right">
                        {item.price !== null ? (
                            <>
                                <p className="text-sm font-bold text-amber-600 dark:text-amber-300">{formatPrice(item.price * (item.quantity || 1))}</p>
                                <p className="text-xs text-slate-400">{formatPrice(item.price)} / шт</p>
                            </>
                        ) : (
                            <p className="text-sm font-bold text-rose-500">Ціну не встановлено</p>
                        )}
                    </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-slate-300 transition hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400" type="button">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
            );
          })}
        </div>
        {hasOutOfStock && (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              Деякі товари закінчилися. Видаліть їх або зменшіть кількість.
            </p>
        )}
          {hasInvalidPrice && (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                  Для деяких товарів немає діючого тарифу для вашої ролі. Купівля неможлива.
              </p>
          )}
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/50 bg-white/75 px-5 py-4 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
          <div>
            <p className="text-xs text-slate-400">Загальна сума</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{formatPrice(total)}</p>
          </div>
            <Link
                to={(hasOutOfStock || hasInvalidPrice) ? '#' : '/checkout'}
                onClick={(e) => { if (hasOutOfStock || hasInvalidPrice) e.preventDefault(); }}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                    (hasOutOfStock || hasInvalidPrice)
                        ? 'cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                        : 'bg-slate-950 text-white hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300'
                }`}
            >
            <ShoppingBag className="h-4 w-4" />
            Оформити замовлення
          </Link>
        </div>
      </div>
  );
}