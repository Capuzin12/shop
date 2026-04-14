import { Heart, ShoppingCart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';

const formatPrice = (price) => new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
}).format(price || 0);

export default function Catalog() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToCart } = useCart();
  const { wishlistIds, toggleWishlist } = useWishlist();

  const [filters, setFilters] = useState({
    category_id: searchParams.get('category_id') || '',
    search: searchParams.get('search') || '',
    min_price: '',
    max_price: '',
    sort_by: 'name',
    sort_order: 'asc',
  });

  const [pagination, setPagination] = useState({
    page: parseInt(searchParams.get('page'), 10) || 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    const searchParam = searchParams.get('search') || '';
    const categoryParam = searchParams.get('category_id') || '';
    const minPriceParam = searchParams.get('min_price') || '';
    const maxPriceParam = searchParams.get('max_price') || '';
    const sortByParam = searchParams.get('sort_by') || 'name';
    const sortOrderParam = searchParams.get('sort_order') || 'asc';
    const pageParam = parseInt(searchParams.get('page'), 10) || 1;

    setFilters({
      category_id: categoryParam,
      search: searchParam,
      min_price: minPriceParam,
      max_price: maxPriceParam,
      sort_by: sortByParam,
      sort_order: sortOrderParam,
    });

    setPagination((prev) => ({ ...prev, page: pageParam }));
  }, [searchParams]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [filters, pagination.page]);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/api/categories');
      const categoriesData = response.data;
      const validCategories = Array.isArray(categoriesData) 
        ? categoriesData.filter(c => c && c.id)
        : [];
      setCategories(validCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
      };

      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.search) params.search = filters.search;
      if (filters.min_price) params.min_price = filters.min_price;
      if (filters.max_price) params.max_price = filters.max_price;

      const response = await api.get('/api/products', { params });
      const productsData = response.data.products;
      const validProducts = Array.isArray(productsData) 
        ? productsData.filter(p => p && p.id)
        : [];
      setProducts(validProducts);
      setPagination((prev) => ({
        ...prev,
        total: response.data.total || 0,
        totalPages: response.data.total_pages || 0,
      }));
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    const nextParams = new URLSearchParams(searchParams);
    if (value) nextParams.set(name, value);
    else nextParams.delete(name);
    nextParams.delete('page');
    setSearchParams(nextParams);
  };

  const handlePageChange = (newPage) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('page', String(newPage));
    setSearchParams(nextParams);
  };

  const renderPagination = () => {
    const { page, totalPages } = pagination;
    if (totalPages <= 1) return null;

    return (
      <div className="mt-10 flex flex-wrap justify-center gap-2">
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((current) => (
          <button
            key={current}
            onClick={() => handlePageChange(current)}
            className={`h-11 min-w-11 rounded-2xl px-4 text-sm font-semibold transition ${
              current === page
                ? 'bg-slate-950 text-white dark:bg-amber-400 dark:text-slate-950'
                : 'border border-white/60 bg-white/70 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900'
            }`}
            type="button"
          >
            {current}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 rounded-[2.25rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">Material Library</p>
        <h1 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">Каталог товарів</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Один стиль для всіх екранів: теплі світлі поверхні, глибокий темний режим і акцент на важливих діях.
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="w-full lg:w-80">
          <div className="sticky top-28 rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Фільтри</h2>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Категорія</span>
                <select name="category_id" value={filters.category_id} onChange={handleFilterChange} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100">
                  <option value="">Усі категорії</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Пошук</span>
                <input name="search" value={filters.search} onChange={handleFilterChange} placeholder="Наприклад, цемент або Bosch" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Ціна від</span>
                  <input type="number" name="min_price" value={filters.min_price} onChange={handleFilterChange} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Ціна до</span>
                  <input type="number" name="max_price" value={filters.max_price} onChange={handleFilterChange} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Сортувати</span>
                  <select name="sort_by" value={filters.sort_by} onChange={handleFilterChange} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100">
                    <option value="name">За назвою</option>
                    <option value="price">За ціною</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Порядок</span>
                  <select name="sort_order" value={filters.sort_order} onChange={handleFilterChange} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100">
                    <option value="asc">Зростання</option>
                    <option value="desc">Спадання</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1">
          {loading ? (
            <div className="rounded-[2rem] border border-white/50 bg-white/70 p-10 text-center text-slate-500 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-400">
              Завантаження каталогу...
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm text-slate-500 dark:text-slate-400">Знайдено {pagination.total} товарів</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => {
                  const liked = wishlistIds.includes(product.id);
                  return (
                    <div key={product.id} className="group rounded-[2rem] border border-white/50 bg-white/80 p-5 shadow-lg shadow-amber-100/30 transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-slate-900/70 dark:shadow-none">
                      <div className="mb-5 rounded-[1.5rem] bg-[linear-gradient(135deg,#fff1de,_#fff9f3)] p-6 dark:bg-[linear-gradient(135deg,#251d18,_#18181f)]">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:bg-white/10 dark:text-slate-300">
                            {product.sku}
                          </span>
                          <button
                            onClick={() => toggleWishlist(product)}
                            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl transition ${
                              liked
                                ? 'bg-rose-100 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300'
                                : 'bg-white/70 text-slate-400 hover:text-rose-500 dark:bg-white/10 dark:text-slate-400 dark:hover:text-rose-300'
                            }`}
                            title={liked ? 'Прибрати з обраного' : 'Додати в обране'}
                            type="button"
                          >
                            <Heart className="h-5 w-5" fill={liked ? 'currentColor' : 'none'} />
                          </button>
                        </div>

                        <div className="mt-10 min-h-[120px]">
                          <h2 className="text-2xl font-bold text-slate-900 transition group-hover:text-amber-700 dark:text-white dark:group-hover:text-amber-300">
                            {product.name}
                          </h2>
                          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                            Артикул {product.sku} • одиниця {product.unit || 'шт'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ціна</p>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-amber-600 dark:text-amber-300">{formatPrice(product.price)}</span>
                            {product.old_price ? <span className="text-sm text-slate-400 line-through">{formatPrice(product.old_price)}</span> : null}
                          </div>
                        </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Link to={`/product/${product.id}`} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
                            Деталі
                          </Link>
                          <button
                            onClick={() => addToCart(product)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
                            type="button"
                          >
                            <ShoppingCart className="h-4 w-4" />
                            До кошика
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {renderPagination()}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
