import api from '../../api';
import { Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, EmptyState, LoadingState, Panel, StatusBadge } from '../../components/BackofficeUI';

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
};

const toBool = (value) => value === true || value === 'true';

export default function AdminProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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
      const response = await api.get('/api/products?limit=100');
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
      const response = await api.get('/api/categories');
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  };

  const loadProductsAndCategories = async ({ showLoading = true } = {}) => {
    if (showLoading) setIsLoading(true);
    try {
      await Promise.all([fetchProducts(), fetchCategories()]);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

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
    };
  };

  const openForEdit = async (product) => {
    try {
      const response = await api.get(`/api/products/${product.id}`);
      const full = response.data || {};
      const imagesText = Array.isArray(full.images)
        ? full.images.map((img) => img?.url).filter(Boolean).join('\n')
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
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    const payload = buildPayload();
    const name = payload.name;
    const slug = payload.slug;
    const sku = payload.sku;
    const price = payload.price;
    const categoryId = payload.category_id;

    if (!name) nextErrors.name = 'Вкажіть назву товару';
    if (!slug) nextErrors.slug = 'Вкажіть slug';
    if (!sku) nextErrors.sku = 'Вкажіть SKU';
    if (!Number.isFinite(price) || price <= 0) nextErrors.price = 'Ціна має бути більшою за 0';
    if (!Number.isInteger(categoryId) || categoryId <= 0) nextErrors.category_id = 'Вкажіть коректний ID категорії';

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
        subtitle="Швидке редагування позицій каталогу"
        actions={(
          <button onClick={() => loadProductsAndCategories()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5" type="button">
            <RefreshCcw className="h-4 w-4" />
            Оновити
          </button>
        )}
      >
        <form noValidate onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          {formError ? <p className="form-error-banner md:col-span-2">{formError}</p> : null}
          <div>
            <input value={formData.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Назва товару *" className={`form-input ${fieldErrors.name ? 'form-input-error' : ''}`} required />
            {fieldErrors.name ? <p className="form-error-text">{fieldErrors.name}</p> : null}
          </div>
          <div>
            <input value={formData.slug} onChange={(e) => updateField('slug', e.target.value)} placeholder="slug *" className={`form-input ${fieldErrors.slug ? 'form-input-error' : ''}`} required />
            {fieldErrors.slug ? <p className="form-error-text">{fieldErrors.slug}</p> : null}
          </div>
          <div>
            <input value={formData.sku} onChange={(e) => updateField('sku', e.target.value)} placeholder="SKU *" className={`form-input ${fieldErrors.sku ? 'form-input-error' : ''}`} required />
            {fieldErrors.sku ? <p className="form-error-text">{fieldErrors.sku}</p> : null}
          </div>
          <div>
            <input value={formData.price} onChange={(e) => updateField('price', e.target.value)} placeholder="Ціна *" type="number" className={`form-input ${fieldErrors.price ? 'form-input-error' : ''}`} required />
            {fieldErrors.price ? <p className="form-error-text">{fieldErrors.price}</p> : null}
          </div>
          <div>
            {categories.length > 0 ? (
              <select value={formData.category_id} onChange={(e) => updateField('category_id', e.target.value)} className={`form-input ${fieldErrors.category_id ? 'form-input-error' : ''}`} required>
                <option value="">Оберіть категорію *</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name} (#{category.id})</option>
                ))}
              </select>
            ) : (
              <input value={formData.category_id} onChange={(e) => updateField('category_id', e.target.value)} placeholder="ID категорії *" type="number" className={`form-input ${fieldErrors.category_id ? 'form-input-error' : ''}`} required />
            )}
            {fieldErrors.category_id ? <p className="form-error-text">{fieldErrors.category_id}</p> : null}
          </div>
          <input value={formData.brand_id} onChange={(e) => updateField('brand_id', e.target.value)} placeholder="ID бренду (необов'язково)" type="number" className="form-input" />
          <input value={formData.old_price} onChange={(e) => updateField('old_price', e.target.value)} placeholder="Стара ціна" type="number" className="form-input" />
          <input value={formData.unit} onChange={(e) => updateField('unit', e.target.value)} placeholder="Одиниця виміру" className="form-input" />
          <input value={formData.icon} onChange={(e) => updateField('icon', e.target.value)} placeholder="Іконка/emoji" className="form-input" />
          <select value={formData.badge} onChange={(e) => updateField('badge', e.target.value)} className="form-input">
            <option value="">Без бейджа</option>
            <option value="new">new</option>
            <option value="sale">sale</option>
            <option value="hit">hit</option>
          </select>
          <input value={formData.weight_kg} onChange={(e) => updateField('weight_kg', e.target.value)} placeholder="Вага (кг)" type="number" className="form-input" />
          <textarea value={formData.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Опис" rows="3" className="form-input" />
          <textarea value={formData.meta_title} onChange={(e) => updateField('meta_title', e.target.value)} placeholder="Meta title" rows="2" className="form-input" />
          <textarea value={formData.meta_description} onChange={(e) => updateField('meta_description', e.target.value)} placeholder="Meta description" rows="2" className="form-input" />
          <div className="md:col-span-2">
            <textarea value={formData.images_text} onChange={(e) => updateField('images_text', e.target.value)} placeholder="URL картинок: по одному URL в рядок" rows="4" className="form-input" />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Перший URL буде головною картинкою.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={toBool(formData.is_active)} onChange={(e) => updateField('is_active', e.target.checked)} />
            Активний товар
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={toBool(formData.is_featured)} onChange={(e) => updateField('is_featured', e.target.checked)} />
            Показувати як featured
          </label>
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-amber-400 dark:text-slate-950" type="submit">
              <Plus className="h-4 w-4" />
              {editing ? 'Зберегти зміни' : 'Додати товар'}
            </button>
            {editing ? (
              <button onClick={() => { setEditing(null); setFormData(DEFAULT_FORM); setFieldErrors({}); setFormError(''); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button">
                Скасувати
              </button>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel title="Список товарів" subtitle={`Усього позицій: ${products.length}`}>
        {isLoading ? (
          <LoadingState />
        ) : products.length === 0 ? (
          <EmptyState title="Товарів немає" text="Додайте перші позиції в каталог." />
        ) : (
          <DataTable columns={['Назва', 'SKU', 'Ціна', 'Категорія', 'Статус', 'Дії']}>
            {products.map((product) => (
              <tr key={product.id} className="align-top">
                <td className="px-4 py-4">
                  <p className="font-semibold text-slate-900 dark:text-white">{product.name}</p>
                </td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{product.sku || '-'}</td>
                <td className="px-4 py-4 font-semibold text-amber-600 dark:text-amber-300">{product.price}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">#{product.category_id}</td>
                <td className="px-4 py-4">{product.badge ? <StatusBadge tone="blue">{product.badge}</StatusBadge> : <StatusBadge>standard</StatusBadge>}</td>
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
