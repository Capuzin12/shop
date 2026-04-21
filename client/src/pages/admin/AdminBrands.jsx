import api from '../../api';
import { Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, EmptyState, LoadingState, Panel, StatusBadge } from '../../components/BackofficeUI';

const DEFAULT_FORM = {
  name: '',
  slug: '',
  description: '',
  country: '',
  logo_url: '',
  website_url: '',
  is_active: true,
};

export default function AdminBrands() {
  const { user } = useAuth();
  const [brands, setBrands] = useState([]);
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

  const fetchBrands = async ({ showLoading = true } = {}) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await api.get('/api/brands');
      setBrands(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching brands:', error);
      setBrands([]);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchBrands();
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    const name = String(formData.name || '').trim();
    const slug = String(formData.slug || '').trim();
    if (!name) nextErrors.name = 'Вкажіть назву бренду';
    if (!slug) nextErrors.slug = 'Вкажіть slug';
    else if (!/^[a-z0-9-]+$/.test(slug)) nextErrors.slug = 'Слаг: малі латинські літери, цифри та дефіс';

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setFormError('Перевірте обовʼязкові поля бренду.');
      return;
    }

    setFormError('');
    try {
      const payload = {
        name,
        slug,
        description: String(formData.description || '').trim() || null,
        country: String(formData.country || '').trim() || null,
        logo_url: String(formData.logo_url || '').trim() || null,
        website_url: String(formData.website_url || '').trim() || null,
        is_active: Boolean(formData.is_active),
      };
      if (editing) await api.put(`/api/brands/${editing}`, payload);
      else await api.post('/api/brands', payload);
      setEditing(null);
      setFormData(DEFAULT_FORM);
      setFieldErrors({});
      await fetchBrands({ showLoading: false });
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setFormError(detail?.message || detail || 'Не вдалося зберегти бренд.');
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Бренди"
        subtitle="Назва, slug, країна, сайт, логотип та активність бренду"
        actions={<button onClick={() => fetchBrands()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button"><RefreshCcw className="h-4 w-4" />Оновити</button>}
      >
        <form noValidate onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          {formError ? <p className="form-error-banner md:col-span-2">{formError}</p> : null}
          <div>
            <input value={formData.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Назва бренду *" className={`form-input ${fieldErrors.name ? 'form-input-error' : ''}`} />
            {fieldErrors.name ? <p className="form-error-text">{fieldErrors.name}</p> : null}
          </div>
          <div>
            <input value={formData.slug} onChange={(e) => updateField('slug', e.target.value)} placeholder="Слаг *" className={`form-input ${fieldErrors.slug ? 'form-input-error' : ''}`} />
            {fieldErrors.slug ? <p className="form-error-text">{fieldErrors.slug}</p> : null}
          </div>
          <input value={formData.country} onChange={(e) => updateField('country', e.target.value)} placeholder="Країна" className="form-input" />
          <input value={formData.logo_url} onChange={(e) => updateField('logo_url', e.target.value)} placeholder="URL логотипу" className="form-input" />
          <input value={formData.website_url} onChange={(e) => updateField('website_url', e.target.value)} placeholder="URL сайту" className="form-input md:col-span-2" />
          <textarea value={formData.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Опис" rows="3" className="form-input md:col-span-2" />
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
            <input type="checkbox" checked={Boolean(formData.is_active)} onChange={(e) => updateField('is_active', e.target.checked)} />
            Активний бренд
          </label>
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-amber-400 dark:text-slate-950" type="submit">
              <Plus className="h-4 w-4" />
              {editing ? 'Зберегти бренд' : 'Додати бренд'}
            </button>
            {editing ? <button onClick={() => { setEditing(null); setFormData(DEFAULT_FORM); setFieldErrors({}); setFormError(''); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button">Скасувати</button> : null}
          </div>
        </form>
      </Panel>

      <Panel title="Усі бренди">
        {isLoading ? (
          <LoadingState />
        ) : brands.length === 0 ? (
          <EmptyState title="Брендів ще немає" text="Додайте перший бренд для каталогу." />
        ) : (
          <DataTable columns={['Назва', 'Слаг', 'Країна', 'Статус', 'Дії']}>
            {brands.map((brand) => (
              <tr key={brand.id}>
                <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">{brand.name}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{brand.slug}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{brand.country || '—'}</td>
                <td className="px-4 py-4"><StatusBadge tone={brand.is_active ? 'emerald' : 'rose'}>{brand.is_active ? 'Активний' : 'Неактивний'}</StatusBadge></td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => { setEditing(brand.id); setFormData({ name: brand.name || '', slug: brand.slug || '', description: brand.description || '', country: brand.country || '', logo_url: brand.logo_url || '', website_url: brand.website_url || '', is_active: brand.is_active !== false }); }} className="text-sm font-semibold text-blue-600 dark:text-blue-300" type="button">Редагувати</button>
                    <button onClick={async () => { if (!confirm('Видалити бренд?')) return; await api.delete(`/api/brands/${brand.id}`); await fetchBrands({ showLoading: false }); }} className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 dark:text-rose-300" type="button"><Trash2 className="h-4 w-4" />Видалити</button>
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



