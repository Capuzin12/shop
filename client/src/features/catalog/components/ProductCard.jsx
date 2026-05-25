import { Heart, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../../../shared/utils/format';

const getStockCopy = (product) => {
  const quantity = product?.quantity ?? 0;
  if (quantity > 9) return { label: 'У наявності', tone: 'emerald' };
  if (quantity > 0) return { label: `Залишок: ${quantity}`, tone: 'amber' };
  return { label: 'Немає на складі', tone: 'rose' };
};

export default function ProductCard({ product, viewConfig, liked, onToggleWishlist, onAddToCart }) {
  const stock = getStockCopy(product);
  const description = product.description || 'Короткий опис буде додано пізніше.';
  const hasCardImage = Boolean(product.image_url);
  const cardBackgroundStyle = hasCardImage
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.4)), url(${product.image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined;

  return (
    <div className={`group flex h-full flex-col rounded-[2rem] border border-white/50 bg-white/80 ${viewConfig.cardPadding} shadow-lg shadow-amber-100/30 transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-slate-900/70 dark:shadow-none`}>
      <div
        className={`mb-5 rounded-[1.5rem] ${viewConfig.previewPadding} ${hasCardImage ? '' : 'bg-[linear-gradient(135deg,#fff1de,_#fff9f3)] dark:bg-[linear-gradient(135deg,#251d18,_#18181f)]'}`}
        style={cardBackgroundStyle}
      >
        <div className="flex items-center justify-between">
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${hasCardImage ? 'bg-black/45 text-white' : 'bg-white/80 text-slate-500 dark:bg-white/10 dark:text-slate-300'}`}>
            {product.sku}
          </span>
          {product.active_discount ? (
            <span className="rounded-full bg-rose-500 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white">
              Акція
            </span>
          ) : null}
          <button
            onClick={() => onToggleWishlist(product)}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl transition ${
              liked
                ? 'bg-rose-100 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300'
                : hasCardImage
                  ? 'bg-black/30 text-white hover:text-rose-300'
                  : 'bg-white/70 text-slate-400 hover:text-rose-500 dark:bg-white/10 dark:text-slate-400 dark:hover:text-rose-300'
            }`}
            title={liked ? 'Прибрати з обраного' : 'Додати в обране'}
            type="button"
          >
            <Heart className="h-5 w-5" fill={liked ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className={`mt-10 ${viewConfig.detailsMinHeight}`}>
          <h2 className={`${viewConfig.titleClass} font-bold transition ${hasCardImage ? 'text-white group-hover:text-amber-200' : 'text-slate-900 group-hover:text-amber-700 dark:text-white dark:group-hover:text-amber-300'}`}>
            {product.name}
          </h2>
          <p className={`mt-3 text-sm ${hasCardImage ? 'text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
            Артикул {product.sku} • одиниця {product.unit || 'шт'}
          </p>
          <p className={`mt-3 line-clamp-3 text-sm leading-6 ${hasCardImage ? 'text-slate-100/95' : 'text-slate-600 dark:text-slate-300'}`}>
            {description}
          </p>
        </div>
      </div>

      <div className="mt-auto space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ціна</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-amber-600 dark:text-amber-300">{formatPrice(product.effective_price ?? product.price)}</span>
              {(product.effective_price ?? product.price) < product.price ? <span className="text-sm text-slate-400 line-through">{formatPrice(product.price)}</span> : null}
            </div>
          </div>
          <span className={`inline-flex max-w-full rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${stock.tone === 'emerald' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : stock.tone === 'amber' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'}`}>
            {stock.label}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link to={`/product/${product.id}`} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
            Деталі
          </Link>
          <button
            onClick={() => onAddToCart(product)}
            disabled={!product.is_active || product.quantity <= 0}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              product.is_active && product.quantity > 0
                ? 'bg-slate-950 text-white hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300'
                : 'cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
            }`}
            type="button"
          >
            <ShoppingCart className="h-4 w-4" />
            {product.is_active && product.quantity > 0 ? 'До кошика' : 'Немає в наявності'}
          </button>
        </div>
      </div>
    </div>
  );
}
