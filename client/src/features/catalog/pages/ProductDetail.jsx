import { ChevronLeft, ChevronRight, Heart, Minus, Plus, Search, ShoppingCart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../../api';
import { useEffectivePrice } from '../../../shared/hooks/useProductPrices';
import { useAuth } from '../../auth/hooks/useAuth';
import { useCart } from '../../cart/context/CartContext';
import { useWishlist } from '../../wishlist/context/WishlistContext';

const formatPrice = (price) => new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
}).format(price || 0);

const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return url;
  return `/${url}`;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const findNextAvailableImageIndex = (startIndex, direction, total, blockedIndexes) => {
  if (!total) return -1;
  const step = direction >= 0 ? 1 : -1;

  for (let offset = 0; offset < total; offset += 1) {
    const index = (startIndex + offset * step + total) % total;
    if (!blockedIndexes.has(index)) return index;
  }

  return -1;
};

const ProductImageDisplay = ({ images, product }) => {
  const [imageError, setImageError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [failedImageIndexes, setFailedImageIndexes] = useState(() => new Set());
  const [isHovering, setIsHovering] = useState(false);
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [zoomPoint, setZoomPoint] = useState({ x: 50, y: 50 });

  const validImages = [
    ...(Array.isArray(images) ? images : []),
    ...(product?.image_url ? [{ url: product.image_url, alt_text: product.name, is_main: true }] : []),
  ]
    .filter((img) => img?.url)
    .map((img) => ({
      ...img,
      resolvedUrl: getImageUrl(img.url),
    }))
    .filter((img) => img.resolvedUrl)
    .filter((img, index, list) => list.findIndex((candidate) => candidate.resolvedUrl === img.resolvedUrl) === index);

  const hasImages = validImages.length > 0 && !imageError;
  const currentImage = validImages[currentImageIndex] || validImages[0];
  const currentImageUrl = currentImage?.resolvedUrl || null;
  const zoomActive = zoomEnabled || isHovering;

  const goToImage = (index) => {
    if (!validImages.length) return;
    const nextIndex = ((index % validImages.length) + validImages.length) % validImages.length;
    setCurrentImageIndex(nextIndex);
    setImageError(false);
  };

  const moveImage = (step) => {
    if (!validImages.length) return;
    const candidate = findNextAvailableImageIndex(
      currentImageIndex + step,
      step,
      validImages.length,
      failedImageIndexes,
    );
    if (candidate !== -1) {
      setCurrentImageIndex(candidate);
      setImageError(false);
    }
  };

  const handleImageError = () => {
    setFailedImageIndexes((previous) => {
      const nextFailed = new Set(previous);
      nextFailed.add(currentImageIndex);

      const nextIndex = findNextAvailableImageIndex(
        currentImageIndex + 1,
        1,
        validImages.length,
        nextFailed,
      );

      if (nextIndex === -1) {
        setImageError(true);
      } else {
        setCurrentImageIndex(nextIndex);
        setImageError(false);
      }

      return nextFailed;
    });
  };

  const handlePointerMove = (event) => {
    if (!currentImageUrl) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);

    setZoomPoint({ x, y });
  };

  if (!hasImages) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-[2rem] bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.25),_transparent_38%),linear-gradient(135deg,#fff3e0,_#fffaf5)] p-8 dark:bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_28%),linear-gradient(135deg,#211916,_#141820)]">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">{product.sku}</p>
          <div className="mt-6 text-7xl font-black text-slate-900 dark:text-white">
            {product.icon || '▣'}
          </div>
          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Карточка матеріалу BuildShop</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.08),_transparent_30%),linear-gradient(135deg,#fffaf4,_#f4f7fb)] dark:bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_26%),linear-gradient(135deg,#211916,_#141820)]"
        style={{ minHeight: '420px' }}
        onPointerEnter={() => setIsHovering(true)}
        onPointerLeave={() => setIsHovering(false)}
        onPointerMove={handlePointerMove}
      >
        <img
          src={currentImageUrl}
          alt={currentImage?.alt_text || product.name}
          className="h-full w-full object-contain p-4 sm:p-6"
          loading="eager"
          onError={handleImageError}
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent dark:from-black/25" />

        <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3">
          <div className="rounded-full bg-slate-950/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white backdrop-blur">
            {currentImageIndex + 1} / {validImages.length}
          </div>

          <div className="flex items-center gap-2">
            {validImages.length > 1 ? (
              <>
                <button
                  onClick={() => moveImage(-1)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-lg shadow-black/10 transition hover:bg-white dark:bg-slate-950/75 dark:text-white"
                  type="button"
                  aria-label="Попереднє фото"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => moveImage(1)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-lg shadow-black/10 transition hover:bg-white dark:bg-slate-950/75 dark:text-white"
                  type="button"
                  aria-label="Наступне фото"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            ) : null}

            <button
              onClick={() => setZoomEnabled((value) => !value)}
              className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-lg shadow-black/10 transition ${
                zoomEnabled
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  : 'bg-white/85 text-slate-700 hover:bg-white dark:bg-slate-950/75 dark:text-white'
              }`}
              type="button"
              aria-pressed={zoomEnabled}
            >
              <Search className="h-4 w-4" />
              <span>{zoomEnabled ? 'Лупа: ON' : 'Лупа'}</span>
            </button>
          </div>
        </div>

        {zoomActive && currentImageUrl ? (
          <div
            className="pointer-events-none absolute h-20 w-20 rounded-full border-2 border-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.35)] ring-1 ring-black/10 sm:h-28 sm:w-28"
            style={{
              left: `${zoomPoint.x}%`,
              top: `${zoomPoint.y}%`,
              transform: 'translate(-50%, -50%)',
              backgroundImage: `url('${currentImageUrl}')`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: '240%',
              backgroundPosition: `${zoomPoint.x}% ${zoomPoint.y}%`,
              backgroundColor: 'rgba(15, 23, 42, 0.08)',
            }}
          />
        ) : null}
      </div>

      {validImages.length > 1 ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {validImages.map((image, idx) => (
            <button
              key={image.id ?? `${image.resolvedUrl}-${idx}`}
              onClick={() => goToImage(idx)}
              className={`group relative h-20 w-20 flex-none overflow-hidden rounded-[1.15rem] border bg-white/80 transition sm:h-24 sm:w-24 ${
                idx === currentImageIndex
                  ? 'border-amber-400 shadow-lg shadow-amber-100 ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
                  : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:hover:border-white/25'
              }`}
              type="button"
              aria-label={`Показати фото ${idx + 1}`}
            >
              <img
                src={image.resolvedUrl}
                alt={image.alt_text || `${product.name} ${idx + 1}`}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <span className={`absolute inset-0 rounded-[1.15rem] transition ${idx === currentImageIndex ? 'bg-amber-400/10' : 'bg-transparent'}`} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsMeta, setReviewsMeta] = useState({ total: 0, avg_rating: null, can_review: false, review_requirement: '' });
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [wishlistMessage, setWishlistMessage] = useState('');
  const { data: effectivePricing } = useEffectivePrice(id, quantity);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productResponse, reviewsResponse] = await Promise.all([
          api.get(`/api/products/${id}`),
          api.get(`/api/products/${id}/reviews`),
        ]);
        setProduct(productResponse.data);
        setReviews(reviewsResponse.data?.reviews || []);
        setReviewsMeta({
          total: reviewsResponse.data?.total || 0,
          avg_rating: reviewsResponse.data?.avg_rating ?? null,
          can_review: Boolean(reviewsResponse.data?.can_review),
          review_requirement: reviewsResponse.data?.review_requirement || '',
        });
      } catch (error) {
        console.error('Error fetching product data:', error);
      }
    };

    fetchData();
  }, [id]);

  const submitReview = async () => {
    if (!user) {
      setReviewMessage('Щоб залишити відгук, спочатку увійдіть в акаунт.');
      return;
    }
    if (!reviewForm.comment.trim() || reviewForm.comment.trim().length < 5) {
      setReviewMessage('Відгук має містити щонайменше 5 символів.');
      return;
    }

    try {
      setReviewSubmitting(true);
      setReviewMessage('');
      await api.post(`/api/products/${id}/reviews`, {
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment,
      });

      const refreshed = await api.get(`/api/products/${id}/reviews`);
      setReviews(refreshed.data?.reviews || []);
      setReviewsMeta({
        total: refreshed.data?.total || 0,
        avg_rating: refreshed.data?.avg_rating ?? null,
        can_review: Boolean(refreshed.data?.can_review),
        review_requirement: refreshed.data?.review_requirement || '',
      });
      setReviewForm((prev) => ({ ...prev, comment: '' }));
      setReviewMessage('Дякуємо! Ваш відгук збережено.');
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setReviewMessage(detail?.message || 'Не вдалося зберегти відгук.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (!product) {
    return <div className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">Завантаження товару...</div>;
  }

  const availableQuantity = product.quantity ?? 0;
  const isOutOfStock = availableQuantity <= 0;
  const normalizedQuantity = Math.min(quantity, Math.max(availableQuantity || 1, 1));

  const liked = isWishlisted(product.id);
  const effectivePrice = Number(effectivePricing?.effective_price ?? product.effective_price ?? product.price);
  const basePrice = Number(effectivePricing?.base_price ?? product.price);
  const hasPersonalPrice = effectivePrice < basePrice;

  return (
    <div className="page-shell">
      <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">

        <div className="rounded-[2.5rem] border border-white/50 bg-white/75 p-6 shadow-xl shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <ProductImageDisplay
            key={`${product.id}-${(Array.isArray(product.images) ? product.images : []).map((img) => img?.url || '').join('|')}-${product.image_url || ''}`}
            images={product.images}
            product={product}
          />
        </div>

        <div className="rounded-[2.5rem] border border-white/50 bg-white/75 p-6 shadow-xl shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">Сторінка товару</p>
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
            <span className="text-4xl font-black text-amber-600 dark:text-amber-300">{formatPrice(effectivePrice)}</span>
            {hasPersonalPrice ? <span className="pb-1 text-lg text-slate-400 line-through">{formatPrice(basePrice)}</span> : null}
            {effectivePricing?.group_name ? (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                {effectivePricing.group_name}
              </span>
            ) : null}
          </div>

          <div className="mt-4 inline-flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${isOutOfStock ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'}`}>
              {isOutOfStock ? 'Немає на складі' : `На складі: ${availableQuantity}`}
            </span>
            {product.in_stock ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:bg-white/10 dark:text-slate-300">В наявності</span> : null}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="inline-flex items-center overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
              <button onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="px-4 py-3 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-white/5" type="button" disabled={isOutOfStock}>
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-14 px-4 text-center text-sm font-semibold text-slate-900 dark:text-white">{normalizedQuantity}</span>
              <button onClick={() => setQuantity((value) => Math.min(value + 1, availableQuantity || 1))} className="px-4 py-3 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-white/5" type="button" disabled={isOutOfStock || normalizedQuantity >= availableQuantity}>
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => addToCart(product, normalizedQuantity)}
              disabled={isOutOfStock}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
              type="button"
            >
              <ShoppingCart className="h-4 w-4" />
              {isOutOfStock ? 'Немає в наявності' : 'Додати до кошика'}
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

          <div className="mt-8 border-t border-slate-200 pt-8 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Відгуки</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {reviewsMeta.total} відгук(ів){reviewsMeta.avg_rating ? ` • середня оцінка ${reviewsMeta.avg_rating}` : ''}
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ваш відгук</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="text-sm text-slate-600 dark:text-slate-300" htmlFor="rating">Оцінка</label>
                <select
                  id="rating"
                  value={reviewForm.rating}
                  onChange={(e) => setReviewForm((prev) => ({ ...prev, rating: Number(e.target.value) }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60"
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>{value} / 5</option>
                  ))}
                </select>
              </div>
              <textarea
                value={reviewForm.comment}
                onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                placeholder="Поділіться враженнями про товар..."
                rows={4}
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                {!user ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Щоб залишити відгук, <Link className="font-semibold text-amber-600 dark:text-amber-300" to="/login">увійдіть у свій акаунт</Link>.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {reviewsMeta.can_review ? 'Ви можете залишити або оновити відгук.' : (reviewsMeta.review_requirement || 'Відгук доступний після отримання товару.')}
                  </p>
                )}
                <button
                  type="button"
                  onClick={submitReview}
                  disabled={reviewSubmitting || (Boolean(user) && !reviewsMeta.can_review)}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
                >
                  {reviewSubmitting ? 'Збереження...' : 'Зберегти відгук'}
                </button>
              </div>
              {reviewMessage ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{reviewMessage}</p> : null}
            </div>

            <div className="mt-4 space-y-3">
              {reviews.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                  Поки що відгуків немає. Будьте першим(ою), хто поділиться враженням.
                </div>
              ) : reviews.map((review) => (
                <div key={review.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-slate-950/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link to={`/users/${review.user_id}`} className="text-sm font-semibold text-slate-900 hover:text-amber-600 dark:text-white dark:hover:text-amber-300">
                      {review.author?.first_name} {review.author?.last_name}
                    </Link>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {review.created_at ? new Date(review.created_at).toLocaleDateString('uk-UA') : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-amber-600 dark:text-amber-300">Оцінка: {review.rating}/5</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{review.comment}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


