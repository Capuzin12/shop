import { Link } from 'react-router-dom';
import { Heart, RefreshCcw, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';

const formatPrice = (price) => new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
}).format(price || 0);

export default function Wishlist() {
  const { addToCart } = useCart();
  const { items, loading, refreshWishlist, removeFromWishlist } = useWishlist();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">Saved List</p>
          <h1 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">Вподобані товари</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Список зберігається навіть без авторизації. Після входу ми підтягуємо його до акаунта автоматично.
          </p>
        </div>
        <button
          onClick={() => refreshWishlist()}
          className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
          type="button"
        >
          <RefreshCcw className="h-4 w-4" />
          Оновити
        </button>
      </div>

      {loading ? (
        <div className="rounded-[2rem] border border-white/50 bg-white/70 p-10 text-center text-slate-500 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-400">
          Завантаження списку...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-amber-200 bg-white/70 p-12 text-center shadow-lg shadow-amber-100/30 backdrop-blur dark:border-amber-500/20 dark:bg-slate-900/60 dark:shadow-none">
          <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <Heart className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Поки що тут порожньо</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Додавайте товари в обране з каталогу або зі сторінки товару.</p>
          <Link to="/catalog" className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300">
            Перейти до каталогу
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <div key={item.product_id} className="group rounded-[2rem] border border-white/50 bg-white/80 p-5 shadow-lg shadow-amber-100/30 transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-slate-900/70 dark:shadow-none">
                <div className="mb-5 rounded-[1.5rem] bg-[linear-gradient(135deg,#ffe9d2,_#fff7ef)] p-6 dark:bg-[linear-gradient(135deg,#2b231d,_#18181f)]">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                    <span>{item.product?.sku || 'BuildShop'}</span>
                    <span className="rounded-full bg-white/80 px-3 py-1 text-rose-500 dark:bg-white/10 dark:text-rose-300">Favorite</span>
                  </div>
                  <h2 className="mt-8 min-h-[72px] text-2xl font-bold text-slate-900 dark:text-white">
                    {item.product?.name || 'Товар'}
                  </h2>
                </div>

                <div className="space-y-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ціна</p>
                      <p className="text-2xl font-black text-amber-600 dark:text-amber-300">
                        {formatPrice(item.product?.price)}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400">
                      Додано {item.added_at ? new Date(item.added_at).toLocaleDateString('uk-UA') : '-'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      to={`/product/${item.product_id}`}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      Деталі
                    </Link>
                    <button
                      onClick={() => addToCart(item.product)}
                      className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
                      type="button"
                    >
                      До кошика
                    </button>
                    <button
                      onClick={() => removeFromWishlist(item.product_id)}
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

          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
            У списку збережено {items.length} товарів.
          </p>
        </>
      )}
    </div>
  );
}
