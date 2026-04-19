import { Heart, ShoppingCart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import Feature from '../components/Feature';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { mapZodErrors, productFilterSchema } from '../utils/validation';

const formatPrice = (price) => new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
}).format(price || 0);

const getStockCopy = (product) => {
  const quantity = product?.quantity ?? 0;
  if (quantity > 9) return { label: 'У наявності', tone: 'emerald' };
  if (quantity > 0) return { label: `Залишок: ${quantity}`, tone: 'amber' };
  return { label: 'Немає на складі', tone: 'rose' };
};

export default function Catalog() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brandFacets, setBrandFacets] = useState([]);
  const [suggestions, setSuggestions] = useState({ products: [], categories: [], brands: [] });
  const [loading, setLoading] = useState(true);
  const [searchMeta, setSearchMeta] = useState({ mode: 'strict', hint: null });
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToCart } = useCart();
  const { wishlistIds, toggleWishlist } = useWishlist();

  const [filters, setFilters] = useState({
    category_id: searchParams.get('category_id') || '',
    search: searchParams.get('search') || '',
    min_price: '',
    max_price: '',
    brand_ids: searchParams.get('brand_ids') || '',
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
    const brandIdsParam = searchParams.get('brand_ids') || '';
    const sortByParam = searchParams.get('sort_by') || 'name';
    const sortOrderParam = searchParams.get('sort_order') || 'asc';
    const pageParam = parseInt(searchParams.get('page'), 10) || 1;

    setFilters({
      category_id: categoryParam,
      search: searchParam,
      min_price: minPriceParam,
      max_price: maxPriceParam,
      brand_ids: brandIdsParam,
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
  }, [filters, pagination.page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const query = (filters.search || '').trim();
    if (query.length < 1) {
      setSuggestions({ products: [], categories: [], brands: [] });
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await api.get('/api/search/suggestions', { params: { q: query } });
        setSuggestions(response.data || { products: [], categories: [], brands: [] });
      } catch {
        setSuggestions({ products: [], categories: [], brands: [] });
      }
    }, 200); // Slightly faster debounce

    return () => window.clearTimeout(timer);
  }, [filters.search]);

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
      if (filters.brand_ids) params.brand_ids = filters.brand_ids;

      const response = await api.get('/api/products', { params });
      const productsData = response.data.products;
      const validProducts = Array.isArray(productsData) 
        ? productsData.filter(p => p && p.id)
        : [];
      setProducts(validProducts);
      setBrandFacets(response.data?.facets?.brands || []);
      setSearchMeta({
        mode: response.data?.search_mode || 'strict',
        hint: response.data?.search_hint || null,
      });
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
    const nextFilters = { ...filters, [name]: value };
    const parsed = productFilterSchema.safeParse(nextFilters);
    if (!parsed.success) {
      const mapped = mapZodErrors(parsed.error);
      const firstError = Object.values(mapped)[0];
      if (firstError) {
        window.dispatchEvent(new CustomEvent('buildshop:toast', {
          detail: {
            title: 'Некоректний фільтр',
            message: firstError,
            level: 'warning',
          },
        }));
      }
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    if (value) nextParams.set(name, value);
    else nextParams.delete(name);
    nextParams.delete('page');
    setSearchParams(nextParams);
  };

  const selectedBrandIds = filters.brand_ids ? filters.brand_ids.split(',').map((v) => v.trim()).filter(Boolean) : [];

  const toggleBrandFilter = (brandId) => {
    const id = String(brandId);
    const current = new Set(selectedBrandIds);
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }

    const nextParams = new URLSearchParams(searchParams);
    const value = Array.from(current).join(',');
    if (value) nextParams.set('brand_ids', value);
    else nextParams.delete('brand_ids');
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

              <Feature flag="experimentalCatalogSuggestions">
                {(suggestions.products.length > 0 || suggestions.categories.length > 0 || suggestions.brands.length > 0) && (
                <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-slate-950/60">
                  {suggestions.products.length > 0 && (
                    <div className="mb-2">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Товари</p>
                      <div className="space-y-1">
                        {suggestions.products.map((item) => (
                          <button
                            key={`sp-${item.id}`}
                            type="button"
                            onClick={() => {
                              const nextParams = new URLSearchParams(searchParams);
                              nextParams.set('search', item.name);
                              nextParams.delete('page');
                              setSearchParams(nextParams);
                            }}
                            className="block w-full rounded-xl px-2 py-1 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                          >
                            <span className="block font-medium">{item.name}</span>
                            <span className="block text-xs text-slate-400">
                              {item.sku}
                              {typeof item.quantity === 'number' ? ` • ${item.quantity > 0 ? `на складі: ${item.quantity}` : 'немає на складі'}` : ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {suggestions.categories.length > 0 && (
                    <div className="mb-2">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Категорії</p>
                      <div className="space-y-1">
                        {suggestions.categories.map((item) => (
                          <button
                            key={`sc-${item.id}`}
                            type="button"
                            onClick={() => {
                              const nextParams = new URLSearchParams(searchParams);
                              nextParams.set('category_id', String(item.id));
                              nextParams.delete('page');
                              setSearchParams(nextParams);
                            }}
                            className="block w-full rounded-xl px-2 py-1 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {suggestions.brands.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Бренди</p>
                      <div className="space-y-1">
                        {suggestions.brands.map((item) => (
                          <button
                            key={`sb-${item.id}`}
                            type="button"
                            onClick={() => toggleBrandFilter(item.id)}
                            className="block w-full rounded-xl px-2 py-1 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                )}
              </Feature>

              {brandFacets.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Бренди</p>
                  <div className="max-h-44 space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/60">
                    {brandFacets.map((brand) => {
                      const checked = selectedBrandIds.includes(String(brand.id));
                      return (
                        <label key={brand.id} className="flex cursor-pointer items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-200">
                          <span className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleBrandFilter(brand.id)}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            {brand.name}
                          </span>
                          <span className="text-xs text-slate-400">{brand.count}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

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
                    <option value="discount">За знижкою</option>
                    <option value="popular">За популярністю</option>
                    <option value="newest">Новинки</option>
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
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Знайдено {pagination.total} товарів</p>
                  {filters.search || filters.category_id || filters.brand_ids ? (
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      {filters.search ? `Пошук: “${filters.search}”` : ''}
                      {filters.category_id ? ` ${filters.search ? '·' : ''} Категорія #${filters.category_id}` : ''}
                      {filters.brand_ids ? ` ${filters.search || filters.category_id ? '·' : ''} Бренди: ${filters.brand_ids}` : ''}
                    </p>
                  ) : null}
                </div>
              </div>

              {filters.search && searchMeta.mode === 'fuzzy' ? (
                <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                  Результати знайдено з урахуванням можливих помилок у запиті.
                  {searchMeta.hint ? ` Можливо, ви мали на увазі: ${searchMeta.hint}.` : ''}
                </div>
              ) : null}

              <div className="grid gap-6 md:grid-cols-2">
                {products.map((product) => {
                  const liked = wishlistIds.includes(product.id);
                  const stock = getStockCopy(product);
                  const description = product.description || 'Короткий опис буде додано пізніше.';
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
                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {description}
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
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${stock.tone === 'emerald' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : stock.tone === 'amber' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'}`}>
                          {stock.label}
                        </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Link to={`/product/${product.id}`} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
                            Деталі
                          </Link>
                          <button
                            onClick={() => addToCart(product)}
                            disabled={!product.is_active || product.quantity <= 0}
                            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                              product.is_active && product.quantity > 0
                                ? 'bg-slate-950 text-white hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300'
                                : 'cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                            }`}
                            type="button"
                          >
                            <ShoppingCart className="h-4 w-4" />
                            {(product.is_active && product.quantity > 0) ? 'До кошика' : 'Немає в наявності'}
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
