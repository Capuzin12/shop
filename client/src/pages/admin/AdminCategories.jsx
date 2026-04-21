import api from '../../api';
import { FolderPlus, RefreshCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, EmptyState, LoadingState, Panel } from '../../components/BackofficeUI';

export default function AdminCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ parent_id: '', name: '', slug: '', description: '', icon: '', image_url: '', sort_order: '0', is_active: true });
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

  const fetchCategories = async ({ showLoading = true } = {}) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await api.get('/api/categories?active_only=false');
      const categoriesData = response.data;
      const validCategories = Array.isArray(categoriesData) 
        ? categoriesData.filter(c => c && c.id)
        : [];
      setCategories(validCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const loadCategories = async () => {
      await fetchCategories();
    };
    loadCategories();
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    const parentId = formData.parent_id === '' ? null : Number(formData.parent_id);
    const name = String(formData.name || '').trim();
    const slug = String(formData.slug || '').trim();
    const sortOrder = Number(formData.sort_order);
    if (!name) nextErrors.name = 'Вкажіть назву категорії';
    if (!slug) nextErrors.slug = 'Вкажіть slug';
    else if (!/^[a-z0-9-]+$/.test(slug)) nextErrors.slug = 'Слаг: малі латинські літери, цифри та дефіс';
    if (!Number.isInteger(sortOrder)) nextErrors.sort_order = 'Порядок сортування має бути цілим числом';
    if (parentId !== null && (!Number.isInteger(parentId) || parentId <= 0 || parentId === Number(editing))) nextErrors.parent_id = 'Оберіть коректну батьківську категорію';

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setFormError('Перевірте обовʼязкові поля форми категорії.');
      return;
    }

    setFormError('');
    try {
      const payload = {
        parent_id: parentId,
        name,
        slug,
        description: String(formData.description || '').trim() || null,
        icon: String(formData.icon || '').trim() || null,
        image_url: String(formData.image_url || '').trim() || null,
        sort_order: sortOrder,
        is_active: Boolean(formData.is_active),
      };
      if (editing) await api.put(`/api/categories/${editing}`, payload);
      else await api.post('/api/categories', payload);
      setEditing(null);
      setFormData({ parent_id: '', name: '', slug: '', description: '', icon: '', image_url: '', sort_order: '0', is_active: true });
      setFieldErrors({});
      fetchCategories({ showLoading: false });
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setFormError(detail?.message || detail || 'Не вдалося зберегти категорію.');
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Категорії"
        subtitle="Структура каталогу, іконки, зображення та порядок відображення"
        actions={<button onClick={() => fetchCategories()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button"><RefreshCcw className="h-4 w-4" />Оновити</button>}
      >
        <form noValidate onSubmit={submit} className="space-y-4">
          {formError ? <p className="form-error-banner">{formError}</p> : null}
          <select value={formData.parent_id} onChange={(e) => updateField('parent_id', e.target.value)} className={`form-input ${fieldErrors.parent_id ? 'form-input-error' : ''}`}>
            <option value="">Без батьківської категорії</option>
            {categories.filter((category) => category.id !== editing).map((category) => (
              <option key={category.id} value={category.id}>{category.name} (#{category.id})</option>
            ))}
          </select>
          {fieldErrors.parent_id ? <p className="form-error-text">{fieldErrors.parent_id}</p> : null}
          <div>
            <input value={formData.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Назва категорії *" className={`form-input ${fieldErrors.name ? 'form-input-error' : ''}`} required />
            {fieldErrors.name ? <p className="form-error-text">{fieldErrors.name}</p> : null}
          </div>
          <div>
            <input value={formData.slug} onChange={(e) => updateField('slug', e.target.value)} placeholder="Слаг *" className={`form-input ${fieldErrors.slug ? 'form-input-error' : ''}`} required />
            {fieldErrors.slug ? <p className="form-error-text">{fieldErrors.slug}</p> : null}
          </div>
          <input value={formData.icon} onChange={(e) => updateField('icon', e.target.value)} placeholder="Іконка або emoji" className="form-input" />
          <input value={formData.image_url} onChange={(e) => updateField('image_url', e.target.value)} placeholder="URL зображення" className="form-input" />
          <input value={formData.sort_order} onChange={(e) => updateField('sort_order', e.target.value)} placeholder="Порядок сортування" type="number" className={`form-input ${fieldErrors.sort_order ? 'form-input-error' : ''}`} />
          {fieldErrors.sort_order ? <p className="form-error-text">{fieldErrors.sort_order}</p> : null}
          <textarea value={formData.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Опис" rows="3" className="form-input" />
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={Boolean(formData.is_active)} onChange={(e) => updateField('is_active', e.target.checked)} />
            Активна категорія
          </label>
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-amber-400 dark:text-slate-950" type="submit"><FolderPlus className="h-4 w-4" />{editing ? 'Зберегти категорію' : 'Додати категорію'}</button>
            {editing ? <button onClick={() => { setEditing(null); setFormData({ parent_id: '', name: '', slug: '', description: '', icon: '', image_url: '', sort_order: '0', is_active: true }); setFieldErrors({}); setFormError(''); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button">Скасувати</button> : null}
          </div>
        </form>
      </Panel>

      <Panel title="Усі категорії">
        {isLoading ? (
          <LoadingState />
        ) : categories.length === 0 ? (
          <EmptyState title="Категорій ще немає" text="Створіть першу категорію для каталогу." />
        ) : (
          <DataTable columns={['Назва', 'Слаг', 'Батьківська', 'Порядок', 'Статус', 'Дії']}>
            {categories.map((category) => (
              <tr key={category.id}>
                <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">{category.name}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{category.slug}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{categories.find((item) => item.id === category.parent_id)?.name || '—'}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{category.sort_order ?? 0}</td>
                <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${category.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'}`}>{category.is_active ? 'Активна' : 'Неактивна'}</span></td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => { setEditing(category.id); setFormData({ parent_id: category.parent_id ?? '', name: category.name, slug: category.slug, description: category.description || '', icon: category.icon || '', image_url: category.image_url || '', sort_order: String(category.sort_order ?? 0), is_active: category.is_active !== false }); }} className="text-sm font-semibold text-blue-600 dark:text-blue-300" type="button">Редагувати</button>
                    <button onClick={async () => { if (!confirm('Видалити категорію?')) return; await api.delete(`/api/categories/${category.id}`); fetchCategories({ showLoading: false }); }} className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 dark:text-rose-300" type="button"><Trash2 className="h-4 w-4" />Видалити</button>
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
