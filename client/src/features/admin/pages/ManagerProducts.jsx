import api from '../../../api';
import { RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { DataTable, EmptyState, LoadingState, Panel, StatusBadge } from '../components/BackofficeUI';

const PAGE_SIZE = 15;

export default function ManagerProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const loadMoreRef = useRef(null);
  const observerRef = useRef(null);
  const searchTimerRef = useRef(null);

  const fetchPage = useCallback(async ({ pageNum = 1, append = false, searchQuery = search } = {}) => {
    if (pageNum === 1 && !append) setIsLoading(true);
    else setLoadingMore(true);

    try {
      const params = { page: pageNum, limit: PAGE_SIZE };
      if (searchQuery) params.search = searchQuery;
      const response = await api.get('/api/products', { params });
      const data = response.data;
      const list = Array.isArray(data.products)
          ? data.products.filter((p) => p && p.id)
          : (Array.isArray(data) ? data.filter((p) => p && p.id) : []);

      setTotalCount(data.total ?? list.length);
      setTotalPages(data.total_pages ?? 1);
      setProducts((prev) => append ? [...prev, ...list] : list);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching products:', error);
      if (!append) setProducts([]);
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
    }
  }, [search]);

  useEffect(() => {
    if (!user) return;
    fetchPage({ pageNum: 1, append: false });
  }, [user, fetchPage]);

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!loadMoreRef.current) return;

    observerRef.current = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      if (isLoading || loadingMore || page >= totalPages) return;
      fetchPage({ pageNum: page + 1, append: true });
    }, { rootMargin: '300px' });

    observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [page, totalPages, isLoading, loadingMore, fetchPage]);

  const handleSearchInput = (value) => {
    setSearchInput(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearch(value);
      setProducts([]);
      setPage(1);
      fetchPage({ pageNum: 1, append: false, searchQuery: value });
    }, 300);
  };

  return (
      <Panel
          title="Товари"
          subtitle={`Показано ${products.length} з ${totalCount}`}
          actions={(
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                      value={searchInput}
                      onChange={(e) => handleSearchInput(e.target.value)}
                      placeholder="Пошук по назві або SKU"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm md:w-56 dark:border-white/10 dark:bg-slate-950/60"
                  />
                  {searchInput ? (
                      <button
                          type="button"
                          onClick={() => { setSearchInput(''); handleSearchInput(''); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs"
                      >
                        ✕
                      </button>
                  ) : null}
                </div>
                <button
                    onClick={() => fetchPage({ pageNum: 1, append: false })}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200"
                    type="button"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Оновити
                </button>
              </div>
          )}
      >
        {isLoading ? (
            <LoadingState />
        ) : products.length === 0 ? (
            <EmptyState
                title="Товарів не знайдено"
                text={search ? 'Нічого не знайдено за вашим запитом.' : 'Спробуйте інший пошуковий запит.'}
            />
        ) : (
            <>
              <DataTable columns={['ID', 'Назва', 'SKU', 'Ціна', 'Стара ціна', 'Бейдж', 'Одиниця']}>
                {products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">#{product.id}</td>
                      <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">{product.name}</td>
                      <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{product.sku}</td>
                      <td className="px-4 py-4 font-semibold text-amber-600 dark:text-amber-300">{product.price}</td>
                      <td className="px-4 py-4 text-sm text-slate-400">{product.old_price || '—'}</td>
                      <td className="px-4 py-4">
                        {product.badge
                            ? <StatusBadge tone={product.badge === 'sale' ? 'rose' : product.badge === 'new' ? 'blue' : 'amber'}>{product.badge}</StatusBadge>
                            : <StatusBadge>стандарт</StatusBadge>}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{product.unit || 'шт'}</td>
                    </tr>
                ))}
              </DataTable>

              <div ref={loadMoreRef} className="h-2 w-full" />

              {loadingMore ? (
                  <p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">
                    Завантаження ще {PAGE_SIZE} товарів...
                  </p>
              ) : page < totalPages ? (
                  <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
                    Прокрутіть вниз для завантаження більше
                  </p>
              ) : (
                  <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
                    Усі {totalCount} товарів завантажено
                  </p>
              )}
            </>
        )}
      </Panel>
  );
}
