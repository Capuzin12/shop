import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '../../cart/context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { formatPrice } from '../../../shared/utils/format';

const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return url;
  return `/${url}`;
};

export default function Wishlist() {
  const { addToCart } = useCart();
  const { items, loading, refreshWishlist, removeFromWishlist } = useWishlist();

  if (loading) {
    return (
        <div className="page-shell">
          <div className="rounded-2xl border border-white/50 bg-white/75 p-10 text-center text-sm text-slate-400 backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
            Завантаження...
          </div>
        </div>
    );
  }

  return (
      <div className="page-shell">
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-white/50 bg-white/75 px-5 py-4 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-300">Обране</p>
            <h1 className="mt-0.5 text-2xl font-black text-slate-900 dark:text-white">Вподобайки</h1>
          </div>
          <button onClick={() => refreshWishlist()} className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition" type="button">
            Оновити
          </button>
        </div>
        {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-10 text-center dark:border-white/10 dark:bg-slate-900/40">
              <Heart className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Список порожній</p>
              <p className="mt-1 text-xs text-slate-400">Додавайте товари з каталогу або сторінки товару</p>
              <Link to="/catalog" className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950">
                До каталогу
              </Link>
            </div>
        ) : (
            <div className="space-y-2">
              {items.map((item) => (
                  <div key={item.product_id} className="flex items-center gap-4 rounded-2xl border border-white/50 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-slate-900/60">
                    {item.product?.image_url ? (
                        <div className="h-12 w-12 flex-none overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                          <img src={getImageUrl(item.product.image_url)} alt={item.product?.name} className="h-full w-full object-cover" loading="lazy" />
                        </div>
                    ) : (
                        <div className="h-12 w-12 flex-none rounded-xl bg-slate-100 dark:bg-slate-800" />
                    )}
                    <div className="min-w-0 flex-1">
                      <Link to={`/product/${item.product_id}`} className="block truncate text-sm font-semibold text-slate-900 hover:text-amber-600 dark:text-white dark:hover:text-amber-300">
                        {item.product?.name || 'Товар'}
                      </Link>
                      <p className="text-xs text-slate-400">{item.product?.sku}</p>
                    </div>
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-300 shrink-0">
                      {formatPrice(item.product?.price)}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                          onClick={() => addToCart(item.product)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
                          type="button"
                      >
                        <ShoppingBag className="h-3 w-3" />
                        До кошика
                      </button>
                      <button onClick={() => removeFromWishlist(item.product_id)} className="text-slate-300 transition hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400" type="button">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
              ))}
              <p className="pt-1 text-center text-xs text-slate-400">{items.length} товарів у списку</p>
            </div>
        )}
      </div>
  );
}