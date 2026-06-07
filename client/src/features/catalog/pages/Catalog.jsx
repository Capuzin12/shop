import { useRef, useEffect } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { mapZodErrors, productFilterSchema } from '../../../shared/utils/validation';
import { useCart } from '../../cart/context/CartContext';
import { useWishlist } from '../../wishlist/context/WishlistContext';
import ProductCard from '../components/ProductCard';
import { useProducts } from '../hooks/useProducts';

const CARD_VIEW_OPTIONS = {
  compact: { label: 'Компактно', minWidth: 240, cardPadding: 'p-4', previewPadding: 'p-5', titleClass: 'text-xl', detailsMinHeight: 'min-h-[96px]', cardImageHeight: '160px' },
  comfortable: { label: 'Комфортно', minWidth: 280, cardPadding: 'p-5', previewPadding: 'p-6', titleClass: 'text-2xl', detailsMinHeight: 'min-h-[120px]', cardImageHeight: '200px' },
  spacious: { label: 'Великий вигляд', minWidth: 340, cardPadding: 'p-6', previewPadding: 'p-7', titleClass: 'text-3xl', detailsMinHeight: 'min-h-[136px]', cardImageHeight: '260px' },
};

function CatalogSearchBar({ value, onChange, suggestions, searchParams, setSearchParams }) {

  const wrapperRef = useRef(null);
  const [isOpen, setIsOpen] = useStateful(false);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setIsOpen]);

  const hasSuggestions = suggestions.products.length > 0 || suggestions.categories.length > 0 || suggestions.brands.length > 0;
  const showDropdown = isOpen && value.trim().length >= 1;

  const applySearch = (q) => {
    const next = new URLSearchParams(searchParams);
    if (q) next.set('search', q);
    else next.delete('search');
    next.delete('page');
    setSearchParams(next);
    setIsOpen(false);
  };

  const applyCategory = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('category_id', id);
    next.delete('page');
    setSearchParams(next);
    setIsOpen(false);
  };

  const applyBrand = (name) => {
    const next = new URLSearchParams(searchParams);
    next.set('search', name);
    next.delete('page');
    setSearchParams(next);
    setIsOpen(false);
  };

  return (
      <div ref={wrapperRef} className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
              type="text"
              name="search"
              value={value}
              onChange={(e) => {
                onChange(e);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="Наприклад, цемент або Bosch"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-11 text-sm text-slate-900 outline-none transition focus:border-amber-300 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
          />
          {value ? (
              <button
                  type="button"
                  onClick={() => {
                    onChange({ target: { name: 'search', value: '' } });
                    setIsOpen(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
          ) : null}
        </div>

        {showDropdown && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-white/60 bg-white shadow-2xl shadow-slate-900/15 dark:border-white/10 dark:bg-slate-900">
              {!hasSuggestions ? (
                  <div className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">
                    Нічого не знайдено для «{value}»
                  </div>
              ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {suggestions.products.length > 0 && (
                        <div>
                          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                            Товари
                          </p>
                          {suggestions.products.slice(0, 6).map((item) => (
                              <button
                                  key={`cp-${item.id}`}
                                  type="button"
                                  onClick={() => applySearch(item.name)}
                                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-amber-50 dark:hover:bg-amber-500/10"
                              >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[10px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 overflow-hidden dark:bg-white/10">
                                    {item.image_url
                                        ? <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                                        : <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{item.sku ? item.sku.slice(0, 2).toUpperCase() : '##'}</span>
                                    }
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{item.name}</p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500">
                                    {item.sku}
                                    {item.brand_name ? ` · ${item.brand_name}` : ''}
                                    {typeof item.quantity === 'number'
                                        ? ` · ${item.quantity > 0 ? `${item.quantity} на складі` : 'немає'}`
                                        : ''}
                                  </p>
                                </div>
                                {item.price ? (
                                    <span className="shrink-0 text-sm font-semibold text-amber-600 dark:text-amber-300">
                          {new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', maximumFractionDigits: 0 }).format(item.price)}
                        </span>
                                ) : null}
                              </button>
                          ))}
                        </div>
                    )}

                    {(suggestions.categories.length > 0 || suggestions.brands.length > 0) && (
                        <div className="border-t border-slate-100 px-4 pt-2 pb-3 dark:border-white/5">
                          {suggestions.categories.length > 0 && (
                              <>
                                <p className="pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Категорії</p>
                                <div className="flex flex-wrap gap-1.5 pb-2">
                                  {suggestions.categories.slice(0, 4).map((item) => (
                                      <button
                                          key={`cc-${item.id}`}
                                          type="button"
                                          onClick={() => applyCategory(item.id)}
                                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-amber-400/30 dark:hover:text-amber-200"
                                      >
                                        {item.name}
                                      </button>
                                  ))}
                                </div>
                              </>
                          )}
                          {suggestions.brands.length > 0 && (
                              <>
                                <p className="pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Бренди</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {suggestions.brands.slice(0, 4).map((item) => (
                                      <button
                                          key={`cb-${item.id}`}
                                          type="button"
                                          onClick={() => applyBrand(item.name)}
                                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-amber-400/30 dark:hover:text-amber-200"
                                      >
                                        {item.name}
                                      </button>
                                  ))}
                                </div>
                              </>
                          )}
                        </div>
                    )}

                    <div className="border-t border-slate-100 px-4 py-2 dark:border-white/5">
                      <button
                          type="button"
                          onClick={() => applySearch(value)}
                          className="flex items-center gap-2 text-xs text-slate-400 transition hover:text-amber-700 dark:hover:text-amber-300"
                      >
                        <Search className="h-3.5 w-3.5" />
                        Показати всі результати для «{value}»
                      </button>
                    </div>
                  </div>
              )}
            </div>
        )}
      </div>
  );
}

function useStateful(initial) {
  // eslint-disable-next-line no-undef
  const { useState } = require('react');
  return useState(initial);
}

export default function Catalog() {
  const {
    brandFacets,
    cardView,
    categories,
    filters,
    hasMore,
    loading,
    loadingMore,
    loadMoreRef,
    pagination,
    products,
    searchMeta,
    searchParams,
    setCardView,
    setSearchParams,
    suggestions,
  } = useProducts();
  const { addToCart } = useCart();
  const { wishlistIds, toggleWishlist } = useWishlist();

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    const nextFilters = { ...filters, [name]: value };
    const parsed = productFilterSchema.safeParse(nextFilters);
    if (!parsed.success) {
      const mapped = mapZodErrors(parsed.error);
      const firstError = Object.values(mapped)[0];
      if (firstError) {
        window.dispatchEvent(new CustomEvent('buildshop:toast', {
          detail: { title: 'Некоректний фільтр', message: firstError, level: 'warning' },
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

  const selectedBrandIds = filters.brand_ids
      ? filters.brand_ids.split(',').map((v) => v.trim()).filter(Boolean)
      : [];

  const toggleBrandFilter = (brandId) => {
    const id = String(brandId);
    const current = new Set(selectedBrandIds);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    const nextParams = new URLSearchParams(searchParams);
    const value = Array.from(current).join(',');
    if (value) nextParams.set('brand_ids', value);
    else nextParams.delete('brand_ids');
    nextParams.delete('page');
    setSearchParams(nextParams);
  };

  const handleLimitChange = (value) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('limit', String(Number(value) || 12));
    setSearchParams(nextParams);
  };

  const handleCardViewChange = (value) => {
    const nextView = CARD_VIEW_OPTIONS[value] ? value : 'comfortable';
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('card_view', nextView);
    setCardView(nextView);
    setSearchParams(nextParams);
  };

  const handleResetFilters = () => {
    const nextParams = new URLSearchParams(searchParams);
    ['category_id', 'search', 'brand_ids', 'min_price', 'max_price', 'sort_by', 'sort_order', 'page'].forEach((k) => nextParams.delete(k));
    setSearchParams(nextParams);
  };

  const selectedCardView = CARD_VIEW_OPTIONS[cardView] ? cardView : 'comfortable';
  const viewConfig = CARD_VIEW_OPTIONS[selectedCardView];
  const productGridStyle = { gridTemplateColumns: `repeat(auto-fit, minmax(${viewConfig.minWidth}px, 1fr))` };

  return (
      <div className="page-shell">
        <div className="mb-8 rounded-[2.25rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">Каталог</p>
          <h1 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">Каталог товарів</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Обирайте матеріали, порівнюйте ціни та додавайте в кошик швидко і без зайвих кроків.
          </p>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="w-full lg:w-80">
            <div className="sticky top-28 rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                  <SlidersHorizontal className="h-4 w-4" />
                  Фільтри
                </h2>
                <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs font-semibold uppercase tracking-wider text-amber-600 hover:text-amber-700 transition-colors dark:text-amber-400 dark:hover:text-amber-300"
                >
                  Скинути
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Категорія</span>
                  <select name="category_id" value={filters.category_id || ''} onChange={handleFilterChange} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100">
                    <option value="">Усі категорії</option>
                    {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>

                {/* Enhanced search with live suggestions */}
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Пошук</span>
                  <CatalogSearchBar
                      value={filters.search || ''}
                      onChange={handleFilterChange}
                      suggestions={suggestions}
                      searchParams={searchParams}
                      setSearchParams={setSearchParams}
                      categories={categories}
                  />
                </label>

                {brandFacets.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Бренди</p>
                      <div className="max-h-44 space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/60">
                        {brandFacets.map((brand) => {
                          const checked = selectedBrandIds.includes(String(brand.id));
                          return (
                              <label key={brand.id} className="flex cursor-pointer items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-200">
                          <span className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={checked} onChange={() => toggleBrandFilter(brand.id)} className="h-4 w-4 rounded border-slate-300" />
                            {brand.name}
                          </span>
                                <span className="text-xs text-slate-400">{brand.count}</span>
                              </label>
                          );
                        })}
                      </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Ціна від</span>
                    <input type="number" name="min_price" value={filters.min_price || ''} onChange={handleFilterChange} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Ціна до</span>
                    <input type="number" name="max_price" value={filters.max_price || ''} onChange={handleFilterChange} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Сортувати</span>
                    <select name="sort_by" value={filters.sort_by || 'name'} onChange={handleFilterChange} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100">
                      <option value="name">За назвою</option>
                      <option value="price">За ціною</option>
                      <option value="discount">За знижкою</option>
                      <option value="popular">За популярністю</option>
                      <option value="newest">Новинки</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Порядок</span>
                    <select name="sort_order" value={filters.sort_order || 'asc'} onChange={handleFilterChange} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100">
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
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Знайдено {pagination.total} товарів</p>
                      {filters.search || filters.category_id || filters.brand_ids ? (
                          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            {filters.search ? `Пошук: "${filters.search}"` : ''}
                            {filters.category_id ? ` ${filters.search ? '•' : ''} Категорія #${filters.category_id}` : ''}
                            {filters.brand_ids ? ` ${filters.search || filters.category_id ? '•' : ''} Бренди: ${filters.brand_ids}` : ''}
                          </p>
                      ) : null}
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Картки</label>
                      <select value={selectedCardView} onChange={(event) => handleCardViewChange(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-200">
                        {Object.entries(CARD_VIEW_OPTIONS).map(([value, config]) => (
                            <option key={value} value={value}>{config.label}</option>
                        ))}
                      </select>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 sm:ml-2">Показувати по</label>
                      <select value={pagination.limit} onChange={(event) => handleLimitChange(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-200">
                        {[8, 12, 16, 24, 32, 48].map((limit) => (
                            <option key={limit} value={limit}>{limit}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {filters.search && searchMeta.mode === 'fuzzy' ? (
                      <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                        Результати знайдено з урахуванням можливих помилок у запиті.
                        {searchMeta.hint ? ` Можливо, ви мали на увазі: ${searchMeta.hint}.` : ''}
                      </div>
                  ) : null}

                  <div className="grid gap-7" style={productGridStyle}>
                    {products.map((product) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            viewConfig={viewConfig}
                            liked={wishlistIds.includes(product.id)}
                            onToggleWishlist={toggleWishlist}
                            onAddToCart={addToCart}
                        />
                    ))}
                  </div>

                  <div className="mt-10">
                    {loadingMore ? (
                        <div className="rounded-2xl border border-white/50 bg-white/70 px-6 py-4 text-center text-sm font-semibold text-slate-600 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
                          Завантаження ще товарів...
                        </div>
                    ) : !hasMore && products.length > 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 px-6 py-5 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-400">
                          Ви переглянули всі товари за цим запитом.
                        </div>
                    ) : null}
                    <div ref={loadMoreRef} className="h-1 w-full" />
                  </div>
                </>
            )}
          </main>
        </div>
      </div>
  );
}