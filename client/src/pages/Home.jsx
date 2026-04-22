import { ArrowRight, Boxes, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const formatPrice = (price) => new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
}).format(price || 0);

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [categoriesRes, productsRes] = await Promise.allSettled([
          api.get('/api/categories'),
          api.get('/api/products', { params: { limit: 8, sort_by: 'popular', sort_order: 'desc' } }),
        ]);

        if (!active) return;

        if (categoriesRes.status === 'fulfilled') {
          const list = Array.isArray(categoriesRes.value?.data) ? categoriesRes.value.data : [];
          setCategories(list.filter((c) => c && c.id).slice(0, 10));
        } else {
          setCategories([]);
        }

        if (productsRes.status === 'fulfilled') {
          const list = Array.isArray(productsRes.value?.data?.products) ? productsRes.value.data.products : [];
          setProducts(list.filter((p) => p && p.id).slice(0, 8));
        } else {
          setProducts([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  const perks = useMemo(() => ([
    { icon: Truck, title: 'Швидко', text: 'Зручний вибір товарів і швидкий перехід до оформлення.' },
    { icon: ShieldCheck, title: 'Надійно', text: 'Прозора наявність та статус замовлення у профілі.' },
    { icon: Boxes, title: 'Все в одному місці', text: 'Категорії, товари та деталі — без зайвих кроків.' },
  ]), []);

  return (
    <div className="page-shell">
      <section className="relative overflow-hidden rounded-[2.75rem] border border-white/50 bg-white/75 px-6 py-12 shadow-2xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none sm:px-10 lg:px-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_52%)] dark:bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_52%)]" />
        <div className="relative grid gap-10 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-amber-100/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
              <Sparkles className="h-4 w-4" />
              BuildShop
            </p>
            <h1 className="mt-5 text-5xl font-black leading-[1.05] text-slate-950 dark:text-white sm:text-6xl">
              Купуйте будматеріали швидко, зручно і без зайвих кліків
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
              Обирайте товари в каталозі, перевіряйте наявність та оформлюйте замовлення — все в одному місці.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/catalog" className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300">
                Перейти до каталогу
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/cart" className="rounded-2xl border border-slate-200 bg-white/60 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-200 dark:hover:bg-white/5">
                Відкрити кошик
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {perks.map((perk) => {
              const Icon = perk.icon;
              return (
                <div key={perk.title} className="rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-lg shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-950/25 dark:shadow-none">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{perk.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{perk.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Популярні категорії</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Швидкий старт — оберіть напрям і переглядайте товари.</p>
          </div>
          <Link to="/catalog" className="text-sm font-semibold text-amber-700 transition hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200">
            Усі категорії <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(categories.length ? categories : Array.from({ length: 8 }, (_, i) => ({ id: `sk-${i}`, name: 'Завантаження…' }))).map((category) => (
            <Link
              key={category.id}
              to={typeof category.id === 'number' ? `/catalog?category_id=${category.id}` : '/catalog'}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                typeof category.id === 'number'
                  ? 'border-white/60 bg-white/70 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-900'
                  : 'border-white/40 bg-white/40 text-slate-400 dark:border-white/10 dark:bg-slate-900/30 dark:text-slate-500'
              }`}
            >
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Популярні товари</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {loading ? 'Підбираємо позиції…' : 'Те, що найчастіше беруть зараз.'}
            </p>
          </div>
          <Link to="/catalog" className="text-sm font-semibold text-amber-700 transition hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200">
            Перейти в каталог <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(products.length ? products : Array.from({ length: 8 }, (_, i) => ({ id: `skp-${i}` }))).map((product) => (
            <Link
              key={product.id}
              to={typeof product.id === 'number' ? `/product/${product.id}` : '/catalog'}
              className={`group rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-lg shadow-amber-100/25 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none ${
                typeof product.id === 'number' ? '' : 'pointer-events-none opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                    {product.sku || 'Товар'}
                  </p>
                  <h3 className="mt-2 line-clamp-2 text-lg font-bold text-slate-900 transition group-hover:text-amber-700 dark:text-white dark:group-hover:text-amber-300">
                    {product.name || 'Завантаження…'}
                  </h3>
                </div>
                <div className="shrink-0 rounded-2xl bg-amber-100 px-3 py-2 text-sm font-black text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                  {product.price ? formatPrice(product.price) : '—'}
                </div>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {product.description || 'Перегляньте деталі товару, щоб дізнатись характеристики та наявність.'}
              </p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Деталі
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
