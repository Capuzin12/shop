import api from '../../api';
import { FolderPlus, RefreshCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, EmptyState, Panel } from '../../components/BackofficeUI';

export default function AdminCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', slug: '', description: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  };

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
      setCategories([]);
    }
  };

  useEffect(() => {
    if (!user?.token) return;
    const loadCategories = async () => {
      await fetchCategories();
    };
    loadCategories();
  }, [user?.token]);

  const submit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    const name = String(formData.name || '').trim();
    const slug = String(formData.slug || '').trim();
    if (!name) nextErrors.name = 'Вкажіть назву категорії';
    if (!slug) nextErrors.slug = 'Вкажіть slug';
    else if (!/^[a-z0-9-]+$/.test(slug)) nextErrors.slug = 'Slug: малі латинські літери, цифри та дефіс';

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setFormError('Перевірте обовʼязкові поля форми категорії.');
      return;
    }

    setFormError('');
    try {
      if (editing) await api.put(`/api/categories/${editing}`, formData);
      else await api.post('/api/categories', formData);
      setEditing(null);
      setFormData({ name: '', slug: '', description: '' });
      setFieldErrors({});
      fetchCategories();
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setFormError(detail?.message || detail || 'Не вдалося зберегти категорію.');
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Категорії"
        subtitle="Структура каталогу й навігація користувача"
        actions={<button onClick={fetchCategories} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button"><RefreshCcw className="h-4 w-4" />Оновити</button>}
      >
        <form noValidate onSubmit={submit} className="space-y-4">
          {formError ? <p className="form-error-banner">{formError}</p> : null}
          <div>
            <input value={formData.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Назва категорії *" className={`form-input ${fieldErrors.name ? 'form-input-error' : ''}`} required />
            {fieldErrors.name ? <p className="form-error-text">{fieldErrors.name}</p> : null}
          </div>
          <div>
            <input value={formData.slug} onChange={(e) => updateField('slug', e.target.value)} placeholder="slug *" className={`form-input ${fieldErrors.slug ? 'form-input-error' : ''}`} required />
            {fieldErrors.slug ? <p className="form-error-text">{fieldErrors.slug}</p> : null}
          </div>
          <textarea value={formData.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Опис" rows="3" className="form-input" />
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-amber-400 dark:text-slate-950" type="submit"><FolderPlus className="h-4 w-4" />{editing ? 'Зберегти категорію' : 'Додати категорію'}</button>
            {editing ? <button onClick={() => { setEditing(null); setFormData({ name: '', slug: '', description: '' }); setFieldErrors({}); setFormError(''); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button">Скасувати</button> : null}
          </div>
        </form>
      </Panel>

      <Panel title="Усі категорії">
        {categories.length === 0 ? (
          <EmptyState title="Категорій ще немає" text="Створіть першу категорію для каталогу." />
        ) : (
          <DataTable columns={['Назва', 'Slug', 'Опис', 'Дії']}>
            {categories.map((category) => (
              <tr key={category.id}>
                <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">{category.name}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{category.slug}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{category.description || '—'}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => { setEditing(category.id); setFormData({ name: category.name, slug: category.slug, description: category.description || '' }); }} className="text-sm font-semibold text-blue-600 dark:text-blue-300" type="button">Редагувати</button>
                    <button onClick={async () => { if (!confirm('Видалити категорію?')) return; await api.delete(`/api/categories/${category.id}`); fetchCategories(); }} className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 dark:text-rose-300" type="button"><Trash2 className="h-4 w-4" />Видалити</button>
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
