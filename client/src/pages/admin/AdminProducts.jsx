import api from '../../api';
import { Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, EmptyState, Panel, StatusBadge } from '../../components/BackofficeUI';

export default function AdminProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: '', category_id: '' });

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

  useEffect(() => {
    if (!user?.token) return;
    const loadProducts = async () => {
      await fetchProducts();
    };
    loadProducts();
  }, [user?.token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/api/products/${editing}`, formData);
      } else {
        await api.post('/api/products', formData);
      }
      setEditing(null);
      setFormData({ name: '', description: '', price: '', category_id: '' });
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Товари"
        subtitle="Швидке редагування позицій каталогу"
        actions={(
          <button onClick={fetchProducts} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5" type="button">
            <RefreshCcw className="h-4 w-4" />
            Оновити
          </button>
        )}
      >
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Назва товару" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950/60" required />
          <input value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="Ціна" type="number" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950/60" required />
          <input value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })} placeholder="ID категорії" type="number" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950/60" required />
          <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Опис" rows="3" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950/60" />
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-amber-400 dark:text-slate-950" type="submit">
              <Plus className="h-4 w-4" />
              {editing ? 'Зберегти зміни' : 'Додати товар'}
            </button>
            {editing ? (
              <button onClick={() => { setEditing(null); setFormData({ name: '', description: '', price: '', category_id: '' }); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button">
                Скасувати
              </button>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel title="Список товарів" subtitle={`Усього позицій: ${products.length}`}>
        {products.length === 0 ? (
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
                    <button onClick={() => { setEditing(product.id); setFormData({ name: product.name, description: product.description || '', price: product.price, category_id: product.category_id }); }} className="text-sm font-semibold text-blue-600 dark:text-blue-300" type="button">
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
