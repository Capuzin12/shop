import { Heart, Minus, Plus, ShoppingCart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';

const formatPrice = (price) => new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
}).format(price || 0);

export default function ProductDetail() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [wishlistMessage, setWishlistMessage] = useState('');

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await api.get(`/api/products/${id}`);
        setProduct(response.data);
      } catch (error) {
        console.error('Error fetching product:', error);
      }
    };

    fetchProduct();
  }, [id]);

  if (!product) {
    return <div className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">Завантаження товару...</div>;
  }

  const liked = isWishlisted(product.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-[2.5rem] border border-white/50 bg-white/75 p-6 shadow-xl shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <div className="flex h-full min-h-[420px] items-center justify-center rounded-[2rem] bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.25),_transparent_38%),linear-gradient(135deg,#fff3e0,_#fffaf5)] p-8 dark:bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_28%),linear-gradient(135deg,#211916,_#141820)]">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">{product.sku}</p>
              <div className="mt-6 text-7xl font-black text-slate-900 dark:text-white">
                {product.icon || '▣'}
              </div>
              <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">BuildShop curated material card</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-white/50 bg-white/75 p-6 shadow-xl shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">Product page</p>
              <h1 className="mt-3 text-4xl font-black text-slate-900 dark:text-white">{product.name}</h1>
            </div>
            <button
              onClick={async () => {
                const nextState = await toggleWishlist(product);
                setWishlistMessage(nextState ? 'Товар додано до вподобайок' : 'Товар прибрано з вподобайок');
              }}
              className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl transition ${
                liked
                  ? 'bg-rose-100 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300'
                  : 'border border-slate-200 text-slate-500 hover:text-rose-500 dark:border-white/10 dark:text-slate-300 dark:hover:text-rose-300'
              }`}
              type="button"
            >
              <Heart className="h-5 w-5" fill={liked ? 'currentColor' : 'none'} />
            </button>
          </div>

          <p className="mt-5 text-sm leading-7 text-slate-600 dark:text-slate-300">{product.description || 'Опис для цього товару ще додається.'}</p>

          <div className="mt-8 flex items-end gap-4">
            <span className="text-4xl font-black text-amber-600 dark:text-amber-300">{formatPrice(product.price)}</span>
            {product.old_price ? <span className="pb-1 text-lg text-slate-400 line-through">{formatPrice(product.old_price)}</span> : null}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="inline-flex items-center overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
              <button onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="px-4 py-3 text-slate-600 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5" type="button">
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-14 px-4 text-center text-sm font-semibold text-slate-900 dark:text-white">{quantity}</span>
              <button onClick={() => setQuantity((value) => value + 1)} className="px-4 py-3 text-slate-600 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5" type="button">
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => addToCart(product, quantity)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
              type="button"
            >
              <ShoppingCart className="h-4 w-4" />
              Додати до кошика
            </button>
          </div>

          {wishlistMessage ? (
            <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              {wishlistMessage}
            </p>
          ) : null}

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">SKU</p>
              <p className="mt-2 font-semibold text-slate-900 dark:text-white">{product.sku}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Категорія</p>
              <p className="mt-2 font-semibold text-slate-900 dark:text-white">#{product.category_id}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Badge</p>
              <p className="mt-2 font-semibold capitalize text-slate-900 dark:text-white">{product.badge || 'standard'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
