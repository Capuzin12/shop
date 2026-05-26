import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';

const MAX_IMAGE_SIZE_BYTES = 32 * 1024 * 1024;

const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function ProductForm({
  brands,
  categories,
  editing,
  fieldErrors,
  formData,
  formError,
  onCancel,
  onChange,
  onSubmit,
  toBool,
}) {
  const fileInputRef = useRef(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const uploadImageToImgbb = async (file) => {
    const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
    if (!apiKey) {
      throw new Error('Відсутній VITE_IMGBB_API_KEY у client/.env');
    }

    const base64Image = await toBase64(file);
    const body = new FormData();
    body.append('image', base64Image);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      body,
    });

    const responseData = await response.json();
    const uploadedUrl = responseData?.data?.url;
    if (!response.ok || !uploadedUrl) {
      throw new Error(responseData?.error?.message || 'Не вдалося завантажити зображення на ImageBB');
    }

    return uploadedUrl;
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Будь ласка, оберіть файл зображення.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      alert('Розмір файлу перевищує 32MB (ліміт ImageBB).');
      return;
    }

    setIsUploadingImage(true);
    try {
      const url = await uploadImageToImgbb(file);
      const current = formData.images_text || '';
      const separator = current.trim() ? '\n' : '';
      onChange('images_text', current + separator + url);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Помилка під час завантаження зображення');
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      {formError ? <p className="form-error-banner">{formError}</p> : null}
      {Object.keys(fieldErrors).length ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {Object.values(fieldErrors).join(' ')}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <input value={formData.name} onChange={(e) => onChange('name', e.target.value)} placeholder="Назва *" className={`form-input text-sm ${fieldErrors.name ? 'form-input-error' : ''}`} required />
          {fieldErrors.name ? <p className="form-error-text text-xs">{fieldErrors.name}</p> : null}
        </div>
        <div>
          <input value={formData.slug} onChange={(e) => onChange('slug', e.target.value)} placeholder="Слаг (авто)" className={`form-input text-sm ${fieldErrors.slug ? 'form-input-error' : ''}`} />
          {fieldErrors.slug ? <p className="form-error-text text-xs">{fieldErrors.slug}</p> : null}
        </div>
        <div>
          <input value={formData.sku} onChange={(e) => onChange('sku', e.target.value)} placeholder="SKU *" className={`form-input text-sm ${fieldErrors.sku ? 'form-input-error' : ''}`} required />
          {fieldErrors.sku ? <p className="form-error-text text-xs">{fieldErrors.sku}</p> : null}
        </div>
        <div>
          <input value={formData.price} onChange={(e) => onChange('price', e.target.value)} placeholder="Ціна *" type="number" className={`form-input text-sm ${fieldErrors.price ? 'form-input-error' : ''}`} required />
          {fieldErrors.price ? <p className="form-error-text text-xs">{fieldErrors.price}</p> : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div>
          {categories.length > 0 ? (
            <select value={formData.category_id} onChange={(e) => onChange('category_id', e.target.value)} className={`form-input text-sm ${fieldErrors.category_id ? 'form-input-error' : ''}`} required>
              <option value="">Категорія *</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          ) : (
            <input value={formData.category_id} onChange={(e) => onChange('category_id', e.target.value)} placeholder="ID категорії *" type="number" className={`form-input text-sm ${fieldErrors.category_id ? 'form-input-error' : ''}`} required />
          )}
          {fieldErrors.category_id ? <p className="form-error-text text-xs">{fieldErrors.category_id}</p> : null}
        </div>
        <div>
          {brands.length > 0 ? (
            <select value={formData.brand_id} onChange={(e) => onChange('brand_id', e.target.value)} className="form-input text-sm">
              <option value="">Без бренду</option>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
          ) : (
            <input value={formData.brand_id} onChange={(e) => onChange('brand_id', e.target.value)} placeholder="ID бренду" type="number" className="form-input text-sm" />
          )}
        </div>
        <input value={formData.old_price} onChange={(e) => onChange('old_price', e.target.value)} placeholder="Стара ціна" type="number" className="form-input text-sm" />
        <select value={formData.badge} onChange={(e) => onChange('badge', e.target.value)} className="form-input text-sm">
          <option value="">Без бейджа</option>
          <option value="new">Новинка</option>
          <option value="sale">Знижка</option>
          <option value="hit">Хіт</option>
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <input value={formData.unit} onChange={(e) => onChange('unit', e.target.value)} placeholder="Одиниця" className="form-input text-sm" />
        <input value={formData.icon} onChange={(e) => onChange('icon', e.target.value)} placeholder="Іконка або emoji" className="form-input text-sm" />
        <input value={formData.weight_kg} onChange={(e) => onChange('weight_kg', e.target.value)} placeholder="Вага (кг)" type="number" className="form-input text-sm" />
        <label className="inline-flex items-center gap-2 pt-3 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={toBool(formData.is_active)} onChange={(e) => onChange('is_active', e.target.checked)} className="rounded" />
          Активний
        </label>
      </div>

      <textarea value={formData.description} onChange={(e) => onChange('description', e.target.value)} placeholder="Опис" rows="2" className="form-input w-full text-sm" />

      <div className="grid gap-3 md:grid-cols-2">
        <textarea value={formData.meta_title} onChange={(e) => onChange('meta_title', e.target.value)} placeholder="SEO-заголовок" rows="2" className="form-input text-sm" />
        <textarea value={formData.meta_description} onChange={(e) => onChange('meta_description', e.target.value)} placeholder="SEO-опис" rows="2" className="form-input text-sm" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <textarea value={formData.images_text} onChange={(e) => onChange('images_text', e.target.value)} placeholder="URL зображень: по одному URL на рядок" rows="3" className="form-input text-sm" />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Перший URL стане головним зображенням.</p>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingImage}
            className="mt-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200"
          >
            {isUploadingImage ? 'Завантаження...' : '📷 Завантажити фото'}
          </button>
        </div>
        <div>
          <textarea value={formData.attributes_text} onChange={(e) => onChange('attributes_text', e.target.value)} placeholder="Атрибути: ключ | значення | одиниця | порядок" rows="3" className="form-input text-sm" />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Приклад: Колір | Синій | шт | 1</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-amber-400 dark:text-slate-950" type="submit">
          <Plus className="h-4 w-4" />
          {editing ? 'Зберегти зміни' : 'Додати товар'}
        </button>
        {editing ? (
          <button onClick={onCancel} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button">
            Скасувати
          </button>
        ) : null}
        <label className="inline-flex items-center gap-2 pt-1 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={toBool(formData.is_featured)} onChange={(e) => onChange('is_featured', e.target.checked)} className="rounded" />
          Рекомендований
        </label>
      </div>
    </form>
  );
}
