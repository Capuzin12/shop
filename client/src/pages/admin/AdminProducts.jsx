import api from '../../api';
import { Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, EmptyState, LoadingState, Panel, StatusBadge } from '../../components/BackofficeUI';
import ProductPricingTable from '../../components/ProductPricingTable';
import ProductDiscountsManager from '../../components/ProductDiscountsManager';
import PriceHistoryLog from '../../components/PriceHistoryLog';
import { isValidSlug, isValidSku, isValidUrl } from '../../utils/validation';

const DEFAULT_FORM = {
  name: '',
  slug: '',
  sku: '',
  description: '',
  price: '',
  old_price: '',
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
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showPriceHistory, setShowPriceHistory] = useState(false);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const fetchProducts = async () => {
    try {
      const response = await api.get('/api/products?active_only=false&limit=100');
      const productsData = response.data;
      const validProducts = Array.isArray(productsData) 
        ? productsData.filter(p => p && p.id)
        : (productsData.products || []).filter(p => p && p.id);
      setProducts(validProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    }
  };

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

  const loadProductsAndCategories = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setIsLoading(true);
    try {
      await Promise.all([fetchProducts(), fetchCategories(), fetchBrands()]);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  const parseImages = (raw) => {
    return String(raw || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => ({
        url: line,
        alt_text: null,
        is_main: index === 0,
        sort_order: index,
      }));
  };

  const parseAttributes = (raw) => {
    return String(raw || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [key = '', value = '', unit = '', sortOrder = ''] = line.split('|').map((part) => part.trim());
        return {
          key,
          value,
          unit: unit || null,
          sort_order: sortOrder ? Number(sortOrder) : index,
        };
      })
      .filter((item) => item.key && item.value);
  };

  const validateImages = (raw) => {
    const lines = String(raw || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (!isValidUrl(line)) {
        return 'Кожне зображення має бути коректним http/https URL';
      }
    }

    return '';
  };

  const validateAttributes = (raw) => {
    const lines = String(raw || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const [key = '', value = '', unit = '', sortOrder = ''] = line.split('|').map((part) => part.trim());
      if (!key || !value) {
        return 'Кожен атрибут має містити ключ і значення';
      }
      if (sortOrder !== '' && !Number.isInteger(Number(sortOrder))) {
        return 'Порядок атрибутів має бути цілим числом';
      }
      if (unit && unit.length > 30) {
        return 'Одиниця атрибуту занадто довга';
      }
    }

    return '';
  };

  const buildPayload = () => {
    return {
      name: String(formData.name || '').trim(),
      slug: String(formData.slug || '').trim(),
      sku: String(formData.sku || '').trim(),
      description: String(formData.description || '').trim() || null,
      price: Number(formData.price),
      old_price: formData.old_price === '' ? null : Number(formData.old_price),
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
    };
  };

  const openForEdit = async (product) => {
    try {
      const response = await api.get(`/api/products/${product.id}`);
      const full = response.data || {};
      const imagesText = Array.isArray(full.images)
        ? full.images.map((img) => img?.url).filter(Boolean).join('\n')
        : '';
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
        old_price: full.old_price ?? '',
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

  useEffect(() => {
    if (!user) return;
    loadProductsAndCategories();
  }, [user, loadProductsAndCategories]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    const payload = buildPayload();
    const name = payload.name;
    const slug = payload.slug;
    const sku = payload.sku;
    const price = payload.price;
    const categoryId = payload.category_id;
    const brandId = payload.brand_id;
    const weight = payload.weight_kg;
    const unit = String(formData.unit || '').trim();
    const oldPrice = formData.old_price === '' ? null : Number(formData.old_price);
    const imagesError = validateImages(formData.images_text);
    const attributesError = validateAttributes(formData.attributes_text);

    if (!name) nextErrors.name = 'Вкажіть назву товару';
    if (!slug) nextErrors.slug = 'Вкажіть slug';
    if (!sku) nextErrors.sku = 'Вкажіть SKU';
    if (!Number.isFinite(price) || price <= 0) nextErrors.price = 'Ціна має бути більшою за 0';
    if (!Number.isInteger(categoryId) || categoryId <= 0) nextErrors.category_id = 'Вкажіть коректний ID категорії';

    if (slug && !isValidSlug(slug)) nextErrors.slug = 'Slug може містити лише малі латинські літери, цифри та дефіс';
    if (sku && !isValidSku(sku)) nextErrors.sku = 'SKU має містити 3-100 символів: літери, цифри, крапку, дефіс, / або _';
    if (brandId !== null && (!Number.isInteger(brandId) || brandId <= 0)) nextErrors.brand_id = 'Бренд має бути коректним ID';
    if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice < 0)) nextErrors.old_price = 'Стара ціна не може бути відʼємною';
    if (oldPrice !== null && Number.isFinite(oldPrice) && oldPrice > 0 && oldPrice <= price) nextErrors.old_price = 'Стара ціна має бути більшою за поточну';
    if (weight !== null && (!Number.isFinite(weight) || weight < 0)) nextErrors.weight_kg = 'Вага має бути невідʼємним числом';
    if (!unit) nextErrors.unit = 'Вкажіть одиницю виміру';
    if (unit.length > 20) nextErrors.unit = 'Одиниця виміру занадто довга';
    if (formData.icon && String(formData.icon).trim().length > 50) nextErrors.icon = 'Іконка або код іконки занадто довгі';
    if (formData.meta_title && String(formData.meta_title).trim().length > 255) nextErrors.meta_title = 'SEO-заголовок має бути до 255 символів';
    if (formData.meta_description && String(formData.meta_description).trim().length > 500) nextErrors.meta_description = 'SEO-опис має бути до 500 символів';
    if (imagesError) nextErrors.images_text = imagesError;
    if (attributesError) nextErrors.attributes_text = attributesError;

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setFormError('Перевірте обовʼязкові поля форми товару.');
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
      fetchProducts();
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
          <button onClick={() => loadProductsAndCategories()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5" type="button">
            <RefreshCcw className="h-4 w-4" />
            Оновити
          </button>
        )}
      >
        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          {formError ? <p className="form-error-banner">{formError}</p> : null}
          {Object.keys(fieldErrors).length ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {Object.values(fieldErrors).join(' ')}
            </div>
          ) : null}
          
          {/* Обов'язкові поля в одному рядку */}
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <input value={formData.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Назва *" className={`form-input text-sm ${fieldErrors.name ? 'form-input-error' : ''}`} required />
              {fieldErrors.name ? <p className="form-error-text text-xs">{fieldErrors.name}</p> : null}
            </div>
            <div>
              <input value={formData.slug} onChange={(e) => updateField('slug', e.target.value)} placeholder="Слаг *" className={`form-input text-sm ${fieldErrors.slug ? 'form-input-error' : ''}`} required />
              {fieldErrors.slug ? <p className="form-error-text text-xs">{fieldErrors.slug}</p> : null}
            </div>
            <div>
              <input value={formData.sku} onChange={(e) => updateField('sku', e.target.value)} placeholder="SKU *" className={`form-input text-sm ${fieldErrors.sku ? 'form-input-error' : ''}`} required />
              {fieldErrors.sku ? <p className="form-error-text text-xs">{fieldErrors.sku}</p> : null}
            </div>
            <div>
              <input value={formData.price} onChange={(e) => updateField('price', e.target.value)} placeholder="Ціна *" type="number" className={`form-input text-sm ${fieldErrors.price ? 'form-input-error' : ''}`} required />
              {fieldErrors.price ? <p className="form-error-text text-xs">{fieldErrors.price}</p> : null}
            </div>
          </div>

          {/* Категорія, бренд, селекти в одному рядку */}
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              {categories.length > 0 ? (
                <select value={formData.category_id} onChange={(e) => updateField('category_id', e.target.value)} className={`form-input text-sm ${fieldErrors.category_id ? 'form-input-error' : ''}`} required>
                  <option value="">Категорія *</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              ) : (
                <input value={formData.category_id} onChange={(e) => updateField('category_id', e.target.value)} placeholder="ID категорії *" type="number" className={`form-input text-sm ${fieldErrors.category_id ? 'form-input-error' : ''}`} required />
              )}
              {fieldErrors.category_id ? <p className="form-error-text text-xs">{fieldErrors.category_id}</p> : null}
            </div>
            <div>
              {brands.length > 0 ? (
                <select value={formData.brand_id} onChange={(e) => updateField('brand_id', e.target.value)} className={`form-input text-sm ${fieldErrors.brand_id ? 'form-input-error' : ''}`}>
                  <option value="">Без бренду</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
              ) : (
                <input value={formData.brand_id} onChange={(e) => updateField('brand_id', e.target.value)} placeholder="ID бренду" type="number" className="form-input text-sm" />
              )}
            </div>
            <input value={formData.old_price} onChange={(e) => updateField('old_price', e.target.value)} placeholder="Стара ціна" type="number" className="form-input text-sm" />
            <select value={formData.badge} onChange={(e) => updateField('badge', e.target.value)} className="form-input text-sm">
              <option value="">Без бейджа</option>
              <option value="new">Новинка</option>
              <option value="sale">Знижка</option>
              <option value="hit">Хіт</option>
            </select>
          </div>

          {/* Додаткові поля в одному рядку */}
          <div className="grid gap-3 md:grid-cols-4">
            <input value={formData.unit} onChange={(e) => updateField('unit', e.target.value)} placeholder="Одиниця виміру" className="form-input text-sm" />
            <input value={formData.icon} onChange={(e) => updateField('icon', e.target.value)} placeholder="Іконка/emoji" className="form-input text-sm" />
            <input value={formData.weight_kg} onChange={(e) => updateField('weight_kg', e.target.value)} placeholder="Вага (кг)" type="number" className="form-input text-sm" />
            <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 pt-3">
              <input type="checkbox" checked={toBool(formData.is_active)} onChange={(e) => updateField('is_active', e.target.checked)} className="rounded" />
              Активний
            </label>
          </div>

          {/* Опис */}
          <textarea value={formData.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Опис товару" rows="2" className="form-input text-sm w-full" />

          {/* SEO поля */}
          <div className="grid gap-3 md:grid-cols-2">
            <textarea value={formData.meta_title} onChange={(e) => updateField('meta_title', e.target.value)} placeholder="SEO-заголовок" rows="2" className="form-input text-sm" />
            <textarea value={formData.meta_description} onChange={(e) => updateField('meta_description', e.target.value)} placeholder="SEO-опис" rows="2" className="form-input text-sm" />
          </div>

          {/* Зображення та атрибути */}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <textarea value={formData.images_text} onChange={(e) => updateField('images_text', e.target.value)} placeholder="URL зображень: по одному URL в рядок" rows="3" className="form-input text-sm" />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Перший URL = головне зображення</p>
            </div>
            <div>
              <textarea value={formData.attributes_text} onChange={(e) => updateField('attributes_text', e.target.value)} placeholder="Атрибути: ключ | значення | одиниця | порядок" rows="3" className="form-input text-sm" />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Приклад: Колір | Сірий | шт | 1</p>
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-amber-400 dark:text-slate-950" type="submit">
              <Plus className="h-4 w-4" />
              {editing ? 'Зберегти зміни' : 'Додати товар'}
            </button>
            {editing ? (
              <button onClick={() => { setEditing(null); setFormData(DEFAULT_FORM); setFieldErrors({}); setFormError(''); }} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button">
                Скасувати
              </button>
            ) : null}
            <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 pt-1">
              <input type="checkbox" checked={toBool(formData.is_featured)} onChange={(e) => updateField('is_featured', e.target.checked)} className="rounded" />
              Рекомендований
            </label>
          </div>
        </form>

        {editing ? (
          <div className="mt-6 space-y-4 border-t border-slate-200 pt-6 dark:border-white/10">
            <ProductPricingTable productId={editing} basePrice={Number(formData.price) || 0} />
            <ProductDiscountsManager productId={editing} />
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
              <button
                type="button"
                className="text-sm font-semibold text-blue-600 dark:text-blue-300"
                onClick={() => setShowPriceHistory((prev) => !prev)}
              >
                {showPriceHistory ? 'Сховати історію цін' : 'Показати історію цін'}
              </button>
              {showPriceHistory ? <div className="mt-3"><PriceHistoryLog productId={editing} /></div> : null}
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel title="Список товарів" subtitle={`Усього позицій: ${products.length}`}>
        {isLoading ? (
          <LoadingState />
        ) : products.length === 0 ? (
          <EmptyState title="Товарів немає" text="Додайте перші позиції в каталог." />
        ) : (
          <DataTable columns={['Назва', 'SKU', 'Ціна', 'Категорія', 'Бренд', 'Статус', 'Дії']}>
            {products.map((product) => (
              <tr key={product.id} className="align-top">
                <td className="px-4 py-4">
                  <p className="font-semibold text-slate-900 dark:text-white">{product.name}</p>
                </td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{product.sku || '-'}</td>
                <td className="px-4 py-4 font-semibold text-amber-600 dark:text-amber-300">{product.price}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{product.category_name || `#${product.category_id}`}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{product.brand_name || '—'}</td>
                <td className="px-4 py-4">{product.badge ? <StatusBadge tone={product.badge === 'sale' ? 'rose' : product.badge === 'new' ? 'blue' : 'amber'}>{product.badge}</StatusBadge> : <StatusBadge>стандарт</StatusBadge>}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => openForEdit(product)} className="text-sm font-semibold text-blue-600 dark:text-blue-300" type="button">
                      Редагувати
                    </button>
                    <button onClick={async () => {
                      if (!confirm('Видалити товар?')) return;
                      await api.delete(`/api/products/${product.id}`);
                      fetchProducts();
                    }} className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 dark:text-rose-300" type="button">
                      <Trash2 className="h-4 w-4" />
                      Видалити
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}
