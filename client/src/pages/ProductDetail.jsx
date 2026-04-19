import { Heart, Minus, Plus, ShoppingCart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';

const formatPrice = (price) => new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
}).format(price || 0);

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
