import api from '../../../api';
import { RefreshCcw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { DataTable, EmptyState, LoadingState, Panel, StatusBadge } from '../components/BackofficeUI';
import ProductForm from '../components/ProductForm';
import ProductPricingTable from '../../../shared/components/ProductPricingTable';
import ProductDiscountsManager from '../../../shared/components/ProductDiscountsManager';
import PriceHistoryLog from '../../../shared/components/PriceHistoryLog';
import { isValidSlug, isValidSku, isValidUrl } from '../../../shared/utils/validation';

const PAGE_SIZE = 15;

const DEFAULT_FORM = {
  name: '',
  slug: '',
  sku: '',
  description: '',
  price: '',
  category_id: '',
  brand_id: '',
  unit: 'шт',
  icon: '',
  badge: '',
  weight_kg: '',
  meta_title: '',
  meta_description: '',
  is_active: true,
  is_featured: false,
  images_text: '',
  attributes_text: '',
};

const toBool = (value) => value === true || value === 'true';

export default function AdminProducts() {
  const { user } = useAuth();

  // Безпечне зчитування початкового стану з кешу
  const [products, setProducts] = useState(() => {
    const saved = sessionStorage.getItem('admin_products_cache');
    return saved ? JSON.parse(saved).products : [];
  });
  const [page, setPage] = useState(() => {
    const saved = sessionStorage.getItem('admin_products_cache');
    return saved ? JSON.parse(saved).page : 1;
  });
  const [totalPages, setTotalPages] = useState(() => {
    const saved = sessionStorage.getItem('admin_products_cache');
    return saved ? JSON.parse(saved).totalPages : 1;
  });
  const [totalCount, setTotalCount] = useState(() => {
    const saved = sessionStorage.getItem('admin_products_cache');
    return saved ? JSON.parse(saved).totalCount : 0;
  });

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');

  // Якщо є кеш — не показуємо початковий глобальний лоадер
  const [isLoading, setIsLoading] = useState(() => !sessionStorage.getItem('admin_products_cache'));
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const loadMoreRef = useRef(null);
  const observerRef = useRef(null);
  const searchTimerRef = useRef(null);

  // Ключовий прапорець: блокує тригери скролу під час відновлення позиції
  const isRestoringRef = useRef(Boolean(sessionStorage.getItem('admin_products_scroll')));

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const fetchProductsPage = useCallback(async ({ pageNum = 1, append = false, searchQuery = search } = {}) => {
    if (pageNum === 1) {
      if (!append) {
        const saved = sessionStorage.getItem('admin_products_cache');
        if (saved && products.length > 0) {
          const cachedSearch = JSON.parse(saved).search;
          // Якщо пошуковий запит збігається з кешованим — не робимо повторний запит
          if (cachedSearch === searchQuery) {
            return;
          }
        }
        setIsLoading(true);
      }
    } else {
      setLoadingMore(true);
    }
    try {
      const params = { page: pageNum, limit: PAGE_SIZE, active_only: false };
      if (searchQuery) params.search = searchQuery;
      const response = await api.get('/api/products', { params });
      const data = response.data;
      const validProducts = Array.isArray(data.products)
          ? data.products.filter((p) => p && p.id)
          : (Array.isArray(data) ? data.filter((p) => p && p.id) : []);

      setTotalCount(data.total ?? validProducts.length);
      setTotalPages(data.total_pages ?? 1);
      setProducts((prev) => append ? [...prev, ...validProducts] : validProducts);
      setPage(pageNum);

      // Якщо це був новий запит без кешу — знімаємо блокування
      isRestoringRef.current = false;
    } catch (error) {
      console.error('Error fetching products:', error);
      if (!append) setProducts([]);
      isRestoringRef.current = false;
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
    }
  }, [search, products.length]);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/api/categories?active_only=false');
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await api.get('/api/brands');
      setBrands(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching brands:', error);
      setBrands([]);
    }
  };

  const reload = useCallback(async () => {
    sessionStorage.removeItem('admin_products_cache');
    sessionStorage.removeItem('admin_products_scroll');
    isRestoringRef.current = false;
    setIsLoading(true);
    await Promise.all([fetchProductsPage({ pageNum: 1, append: false }), fetchCategories(), fetchBrands()]);
  }, [fetchProductsPage]);

  useEffect(() => {
    if (!user) return;
    // Завантажуємо категорії та бренди, а товари підтягнуться або з кешу, або з першого запиту всередині fetchProductsPage
    fetchCategories();
    fetchBrands();
    fetchProductsPage({ pageNum: 1, append: false });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!loadMoreRef.current) return;

    observerRef.current = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;

      // НАДІЙНИЙ ЗАХИСТ: Якщо ми все ще відновлюємо позицію скролу — ігноруємо тригер пагінації
      if (isRestoringRef.current) return;

      if (isLoading || loadingMore) return;
      if (page >= totalPages) return;
      fetchProductsPage({ pageNum: page + 1, append: true });
    }, { rootMargin: '300px' });

    observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [page, totalPages, isLoading, loadingMore, fetchProductsPage]);

  // Debounced search
  const handleSearchInput = (value) => {
    setSearchInput(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearch(value);
      setProducts([]);
      setPage(1);
      isRestoringRef.current = false;
      fetchProductsPage({ pageNum: 1, append: false, searchQuery: value });
    }, 300);
  };

  // ── Ефекти для скролу та синхронізації кешу ────────────────

  useEffect(() => {
    if (products.length > 0) {
      sessionStorage.setItem('admin_products_cache', JSON.stringify({ products, page, totalPages, totalCount, search }));
    }
  }, [products, page, totalPages, totalCount, search]);

  useEffect(() => {
    const scrollContainer = document.querySelector('.max-h-\\[65vh\\]');
    const savedScroll = sessionStorage.getItem('admin_products_scroll');

    if (scrollContainer && savedScroll && products.length > 0) {
      const timer = setTimeout(() => {
        scrollContainer.scrollTop = parseInt(savedScroll, 10);
        // Знімаємо блокування ОДРАЗУ ПІСЛЯ того, як контейнер став на потрібну позицію
        setTimeout(() => {
          isRestoringRef.current = false;
        }, 50);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      isRestoringRef.current = false;
    }
  }, [products]);

  useEffect(() => {
    const scrollContainer = document.querySelector('.max-h-\\[65vh\\]');
    if (!scrollContainer) return;

    const handleScroll = () => {
      // Записуємо позицію лише тоді, коли не виконується відновлення старого скролу
      if (!isRestoringRef.current) {
        sessionStorage.setItem('admin_products_scroll', String(scrollContainer.scrollTop));
      }
    };
    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [isLoading, products]);

  // ── form helpers ──────────────────────────────────────────

  const parseImages = (raw) =>
      String(raw || '').split('\n').map((l) => l.trim()).filter(Boolean).map((url, i) => ({
        url, alt_text: null, is_main: i === 0, sort_order: i,
      }));

  const parseAttributes = (raw) =>
      String(raw || '').split('\n').map((l) => l.trim()).filter(Boolean).map((line, i) => {
        const [key = '', value = '', unit = '', sortOrder = ''] = line.split('|').map((p) => p.trim());
        return { key, value, unit: unit || null, sort_order: sortOrder ? Number(sortOrder) : i };
      }).filter((a) => a.key && a.value);

  const validateImages = (raw) => {
    const lines = String(raw || '').split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) if (!isValidUrl(line)) return 'Кожне зображення має бути коректним http/https URL';
    return '';
  };

  const validateAttributes = (raw) => {
    const lines = String(raw || '').split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const [key = '', value = '', , sortOrder = ''] = line.split('|').map((p) => p.trim());
      if (!key || !value) return 'Кожен атрибут має містити ключ і значення';
      if (sortOrder !== '' && !Number.isInteger(Number(sortOrder))) return 'Порядок атрибутів має бути цілим числом';
    }
    return '';
  };

  const buildPayload = () => ({
    name: String(formData.name || '').trim(),
    slug: String(formData.slug || '').trim(),
    sku: String(formData.sku || '').trim(),
    description: String(formData.description || '').trim() || null,
    category_id: Number(formData.category_id),
    brand_id: formData.brand_id === '' ? null : Number(formData.brand_id),
    unit: String(formData.unit || '').trim() || 'шт',
    icon: String(formData.icon || '').trim() || null,
    badge: String(formData.badge || '').trim() || null,
    weight_kg: formData.weight_kg === '' ? null : Number(formData.weight_kg),
    meta_title: String(formData.meta_title || '').trim() || null,
    meta_description: String(formData.meta_description || '').trim() || null,
    is_active: toBool(formData.is_active),
    is_featured: toBool(formData.is_featured),
    images: parseImages(formData.images_text),
    attributes: parseAttributes(formData.attributes_text),
  });

  const openForEdit = async (product) => {
    try {
      const response = await api.get(`/api/products/${product.id}`);
      const full = response.data || {};
      const imagesText = Array.isArray(full.images) ? full.images.map((img) => img?.url).filter(Boolean).join('\n') : '';
      const attributesText = Array.isArray(full.attributes)
          ? full.attributes.map((attr) => [attr?.key || '', attr?.value || '', attr?.unit || '', attr?.sort_order ?? ''].join(' | ')).join('\n')
          : '';
      setEditing(product.id);
      setFormData({
        name: full.name || '',
        slug: full.slug || '',
        sku: full.sku || '',
        description: full.description || '',
        price: full.price ?? '',
        category_id: full.category_id ?? '',
        brand_id: full.brand_id ?? '',
        unit: full.unit || 'шт',
        icon: full.icon || '',
        badge: full.badge || '',
        weight_kg: full.weight_kg ?? '',
        meta_title: full.meta_title || '',
        meta_description: full.meta_description || '',
        is_active: full.is_active !== false,
        is_featured: Boolean(full.is_featured),
        images_text: imagesText,
        attributes_text: attributesText,
      });
      setFieldErrors({});
      setFormError('');
    } catch (error) {
      console.error('Error loading product detail:', error);
      setFormError('Не вдалося завантажити повні дані товару для редагування.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    const payload = buildPayload();
    const { name, slug, sku, category_id: categoryId, brand_id: brandId, weight_kg: weight, unit } = payload;
    const imagesError = validateImages(formData.images_text);
    const attributesError = validateAttributes(formData.attributes_text);

    if (!name) nextErrors.name = 'Вкажіть назву товару';
    if (!sku) nextErrors.sku = 'Вкажіть SKU';
    if (!Number.isInteger(categoryId) || categoryId <= 0) nextErrors.category_id = 'Вкажіть коректний ID категорії';
    if (slug && !isValidSlug(slug)) nextErrors.slug = 'Slug може містити лише малі латинські літери, цифри та дефіс';
    if (sku && !isValidSku(sku)) nextErrors.sku = 'SKU має містити 3-100 symbols: літери, цифри, крапку, дефіс, / або _';
    if (brandId !== null && (!Number.isInteger(brandId) || brandId <= 0)) nextErrors.brand_id = 'Бренд має бути коректним ID';
    if (weight !== null && (!Number.isFinite(weight) || weight < 0)) nextErrors.weight_kg = 'Вага має бути невід\'ємним числом';
    if (!unit) nextErrors.unit = 'Вкажіть одиницю виміру';
    if (imagesError) nextErrors.images_text = imagesError;
    if (attributesError) nextErrors.attributes_text = attributesError;

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setFormError('Перевірте обов\'язкові поля форми товару.');
      return;
    }

    setFormError('');
    try {
      if (editing) {
        await api.put(`/api/products/${editing}`, payload);
      } else {
        await api.post('/api/products', payload);
      }
      setEditing(null);
      setFormData(DEFAULT_FORM);
      setFieldErrors({});
      sessionStorage.removeItem('admin_products_cache');
      await fetchProductsPage({ pageNum: 1, append: false });
    } catch (error) {
      console.error('Error saving product:', error);
      const detail = error?.response?.data?.detail;
      setFormError(detail?.message || detail || 'Не вдалося зберегти товар.');
    }
  };

  return (
      <div className="space-y-6">
        <Panel
            title="Товари"
            subtitle="Редагуйте назву, слаг, SKU, ціни, бренд, категорію, зображення, атрибути та SEO-поля"
            actions={(
                <button onClick={reload} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5" type="button">
                  <RefreshCcw className="h-4 w-4" />
                  Оновити
                </button>
            )}
        >
          <ProductForm
              brands={brands}
              categories={categories}
              editing={editing}
              fieldErrors={fieldErrors}
              formData={formData}
              formError={formError}
              onCancel={() => {
                setEditing(null);
                setFormData(DEFAULT_FORM);
                setFieldErrors({});
                setFormError('');
              }}
              onChange={updateField}
              onSubmit={handleSubmit}
              toBool={toBool}
          />

          {editing ? (
              <div className="mt-6 space-y-4 border-t border-slate-200 pt-6 dark:border-white/10">
                <ProductPricingTable productId={editing} />
                <ProductDiscountsManager productId={editing} />
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <button type="button" className="text-sm font-semibold text-blue-600 dark:text-blue-300" onClick={() => setShowPriceHistory((prev) => !prev)}>
                    {showPriceHistory ? 'Сховати історію цін' : 'Показати історію цін'}
                  </button>
                  {showPriceHistory ? <div className="mt-3"><PriceHistoryLog key={editing} productId={editing} /></div> : null}
                </div>
              </div>
          ) : null}
        </Panel>

        <Panel
            title="Список товарів"
            subtitle={`Показано ${products.length} з ${totalCount} товарів`}
            actions={(
                <div className="relative">
                  <input
                      value={searchInput}
                      onChange={(e) => handleSearchInput(e.target.value)}
                      placeholder="Пошук по назві або SKU"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm md:w-64 dark:border-white/10 dark:bg-slate-950/60"
                  />
                  {searchInput ? (
                      <button
                          type="button"
                          onClick={() => { setSearchInput(''); handleSearchInput(''); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        ✕
                      </button>
                  ) : null}
                </div>
            )}
        >
          {isLoading ? (
              <LoadingState />
          ) : products.length === 0 ? (
              <EmptyState title="Товарів немає" text={search ? 'Нічого не знайдено за вашим запитом.' : 'Додайте перші позиції в каталог.'} />
          ) : (
              <>
                <DataTable columns={['Назва', 'SKU', 'Ціна', 'Категорія', 'Бренд', 'Статус', 'Дії']}>
                  {products.map((product) => (
                      <tr
                          key={product.id}
                          className={`align-top transition ${editing === product.id ? 'bg-blue-50 dark:bg-blue-500/10 border-l-4 border-blue-500' : 'border-l-4 border-transparent hover:bg-slate-50 dark:hover:bg-white/5'}`}
                      >
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{product.name}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{product.sku || '-'}</td>
                        <td className="px-4 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400">За тарифами</td>
                        <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{product.category_name || `#${product.category_id}`}</td>
                        <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{product.brand_name || '—'}</td>
                        <td className="px-4 py-4">
                          {product.badge
                              ? <StatusBadge tone={product.badge === 'sale' ? 'rose' : product.badge === 'new' ? 'blue' : 'amber'}>{product.badge}</StatusBadge>
                              : <StatusBadge>стандарт</StatusBadge>}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-3">
                            <button onClick={() => openForEdit(product)} className="text-sm font-semibold text-blue-600 dark:text-blue-300" type="button">
                              Редагувати
                            </button>
                            <button
                                onClick={async () => {
                                  if (!confirm('Видалити товар?')) return;
                                  await api.delete(`/api/products/${product.id}`);
                                  sessionStorage.removeItem('admin_products_cache');
                                  await fetchProductsPage({ pageNum: 1, append: false });
                                }}
                                className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 dark:text-rose-300"
                                type="button"
                            >
                              <Trash2 className="h-4 w-4" />
                              Видалити
                            </button>
                          </div>
                        </td>
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
                      Прокрутіть вниз, щоб завантажити більше
                    </p>
                ) : products.length > 0 ? (
                    <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
                      Усі {totalCount} товарів завантажено
                    </p>
                ) : null}
              </>
          )}
        </Panel>
      </div>
  );
}