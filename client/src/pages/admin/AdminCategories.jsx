import { FolderPlus, RefreshCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, EmptyState, Panel } from '../../components/BackofficeUI';

export default function AdminCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', slug: '', description: '' });

  const auth = { headers: { Authorization: `Bearer ${user?.token}` } };

  const fetchCategories = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/categories', auth);
      setCategories(Array.isArray(response.data) ? response.data : []);
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
    if (editing) await axios.put(`http://localhost:8000/api/categories/${editing}`, formData, auth);
    else await axios.post('http://localhost:8000/api/categories', formData, auth);
    setEditing(null);
    setFormData({ name: '', slug: '', description: '' });
    fetchCategories();
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Категорії"
        subtitle="Структура каталогу й навігація користувача"
        actions={<button onClick={fetchCategories} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button"><RefreshCcw className="h-4 w-4" />Оновити</button>}
      >
        <form onSubmit={submit} className="space-y-4">
          <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Назва категорії" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950/60" required />
          <input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder="slug" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950/60" required />
          <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Опис" rows="3" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950/60" />
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-amber-400 dark:text-slate-950" type="submit"><FolderPlus className="h-4 w-4" />{editing ? 'Зберегти категорію' : 'Додати категорію'}</button>
            {editing ? <button onClick={() => { setEditing(null); setFormData({ name: '', slug: '', description: '' }); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button">Скасувати</button> : null}
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
                    <button onClick={async () => { if (!confirm('Видалити категорію?')) return; await axios.delete(`http://localhost:8000/api/categories/${category.id}`, auth); fetchCategories(); }} className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 dark:text-rose-300" type="button"><Trash2 className="h-4 w-4" />Видалити</button>
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
