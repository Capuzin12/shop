import Feature from '../../../shared/components/Feature';
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

  const selectedBrandIds = filters.brand_ids ? filters.brand_ids.split(',').map((value) => value.trim()).filter(Boolean) : [];

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

  // Додана функція скидання фільтрів
  const handleResetFilters = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('category_id');
    nextParams.delete('search');
    nextParams.delete('brand_ids');
    nextParams.delete('min_price');
    nextParams.delete('max_price');
    nextParams.delete('sort_by');
    nextParams.delete('sort_order');
    nextParams.delete('page');
    setSearchParams(nextParams);
  };

  const selectedCardView = CARD_VIEW_OPTIONS[cardView] ? cardView : 'comfortable';
  const viewConfig = CARD_VIEW_OPTIONS[selectedCardView];
  const productGridStyle = {
    gridTemplateColumns: `repeat(auto-fit, minmax(${viewConfig.minWidth}px, 1fr))`,
  };

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
              {/* Додано кнопку "Скинути" поруч із заголовком */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Фільтри</h2>
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

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Пошук</span>
                  <input name="search" value={filters.search || ''} onChange={handleFilterChange} placeholder="Наприклад, цемент або Bosch" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" />
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
                                    <button key={`sb-${item.id}`} type="button" onClick={() => toggleBrandFilter(item.id)} className="block w-full rounded-xl px-2 py-1 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">
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
                            {filters.search ? `Пошук: “${filters.search}”` : ''}
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
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 sm:ml-2">товарів.</label>
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