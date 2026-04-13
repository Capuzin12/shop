import { RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, EmptyState, Panel, StatusBadge } from '../../components/BackofficeUI';

export default function ManagerProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProducts = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/products?limit=100', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setProducts(Array.isArray(response.data) ? response.data : response.data.products || []);
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

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Panel
      title="Товари"
      subtitle="Швидкий огляд асортименту для менеджера"
      actions={<button onClick={fetchProducts} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button"><RefreshCcw className="h-4 w-4" />Оновити</button>}
    >
      <div className="mb-5">
        <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Пошук по назві або SKU" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm md:w-72 dark:border-white/10 dark:bg-slate-950/60" />
      </div>
      {filteredProducts.length === 0 ? (
        <EmptyState title="Товарів не знайдено" text="Спробуйте інший пошуковий запит." />
      ) : (
        <DataTable columns={['ID', 'Назва', 'SKU', 'Ціна', 'Стара ціна', 'Badge', 'Одиниця']}>
          {filteredProducts.map((product) => (
            <tr key={product.id}>
              <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">#{product.id}</td>
              <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">{product.name}</td>
              <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{product.sku}</td>
              <td className="px-4 py-4 font-semibold text-amber-600 dark:text-amber-300">{product.price}</td>
              <td className="px-4 py-4 text-sm text-slate-400">{product.old_price || '—'}</td>
              <td className="px-4 py-4">{product.badge ? <StatusBadge tone={product.badge === 'sale' ? 'rose' : product.badge === 'new' ? 'blue' : 'amber'}>{product.badge}</StatusBadge> : <StatusBadge>none</StatusBadge>}</td>
              <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{product.unit || 'шт'}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </Panel>
  );
}
