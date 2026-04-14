import api from '../../api';
import { RefreshCcw, Siren } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { DataTable, EmptyState, FilterButton, Panel, StatCard, StatusBadge } from '../../components/BackofficeUI';

export default function ManagerInventory() {
  const { user } = useAuth();
  const { refreshNotifications } = useNotifications();
  const [inventory, setInventory] = useState([]);
  const [filter, setFilter] = useState('all');
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchInventory = async () => {
    try {
      const response = await api.get('/api/inventory');
      const inventoryData = response.data;
      const validInventory = Array.isArray(inventoryData) 
        ? inventoryData.filter(item => item && item.id)
        : [];
      setInventory(validInventory);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      setInventory([]);
    }
  };

  const checkLowStock = async (token) => {
    try {
      await api.get('/api/notifications/check-low-stock');
      refreshNotifications(token);
      fetchInventory();
    } catch (error) {
      console.error('Error checking low stock:', error);
    }
  };

  useEffect(() => {
    if (!user?.token) return;
    const loadInventory = async () => {
      await fetchInventory();
      await checkLowStock(user.token);
    };
    loadInventory();
  }, [user?.token]);

  const threshold = (item) => item.min_quantity_alert ?? item.min_quantity;
  const isLowStock = (item) => item.quantity < threshold(item);
  const isOutOfStock = (item) => item.quantity === 0;

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = item.product_name.toLowerCase().includes(searchTerm.toLowerCase());
    if (filter === 'all') return matchesSearch;
    if (filter === 'low') return matchesSearch && isLowStock(item);
    if (filter === 'out') return matchesSearch && isOutOfStock(item);
    if (filter === 'ok') return matchesSearch && !isLowStock(item);
    return matchesSearch;
  });

  const lowStockCount = inventory.filter(isLowStock).length;
  const outOfStockCount = inventory.filter(isOutOfStock).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={RefreshCcw} label="Усього позицій" value={inventory.length} tone="blue" />
        <StatCard icon={Siren} label="Низький запас" value={lowStockCount} tone="rose" />
        <StatCard icon={RefreshCcw} label="Немає в наявності" value={outOfStockCount} tone="amber" />
      </div>

      <Panel
        title="Склад менеджера"
        subtitle="Оперативне редагування запасів і запуск перевірки low-stock"
        actions={(
          <>
            <button onClick={() => fetchInventory()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button">
              <RefreshCcw className="h-4 w-4" />
              Оновити
            </button>
            <button onClick={() => checkLowStock(user?.token)} className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-amber-400 dark:text-slate-950" type="button">
              Перевірити запас
            </button>
          </>
        )}
      >
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Пошук товару" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm md:w-72 dark:border-white/10 dark:bg-slate-950/60" />
          <div className="flex flex-wrap gap-2">
            {['all', 'low', 'out', 'ok'].map((current) => (
              <FilterButton key={current} active={filter === current} alert={current === 'low' || current === 'out'} onClick={() => setFilter(current)}>
                {current}
              </FilterButton>
            ))}
          </div>
        </div>

        {filteredInventory.length === 0 ? (
          <EmptyState title="Нічого не знайдено" text="Спробуйте інший фільтр або пошуковий запит." />
        ) : (
          <DataTable columns={['Товар', 'Кількість', 'Мін / Макс', 'Поріг', 'Місце', 'Статус', 'Дії']}>
            {filteredInventory.map((item) => (
              <tr key={item.id} className={isOutOfStock(item) ? 'bg-rose-50/50 dark:bg-rose-500/5' : isLowStock(item) ? 'bg-amber-50/50 dark:bg-amber-500/5' : ''}>
                <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">{item.product_name}</td>
                <td className="px-4 py-4">{editingItem?.id === item.id ? <input value={editingItem.quantity} onChange={(e) => setEditingItem({ ...editingItem, quantity: parseInt(e.target.value, 10) || 0 })} className="w-20 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/60" type="number" /> : <span className="font-semibold">{item.quantity}</span>}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{item.min_quantity} / {item.max_quantity}</td>
                <td className="px-4 py-4">{editingItem?.id === item.id ? <input value={editingItem.min_quantity_alert} onChange={(e) => setEditingItem({ ...editingItem, min_quantity_alert: parseInt(e.target.value, 10) || 0 })} className="w-20 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/60" type="number" /> : <span className="text-sm text-slate-500 dark:text-slate-400">{threshold(item)}</span>}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{item.location || '—'}</td>
                <td className="px-4 py-4">{isOutOfStock(item) ? <StatusBadge tone="rose">Немає</StatusBadge> : isLowStock(item) ? <StatusBadge tone="amber">Мало</StatusBadge> : <StatusBadge tone="emerald">У нормі</StatusBadge>}</td>
                <td className="px-4 py-4">
                  {editingItem?.id === item.id ? (
                    <div className="flex gap-3">
                      <button onClick={async () => { await api.put(`/api/inventory/${item.id}`, { quantity: editingItem.quantity, min_quantity: item.min_quantity, min_quantity_alert: editingItem.min_quantity_alert }); setEditingItem(null); refreshNotifications(user?.token); fetchInventory(); }} className="text-sm font-semibold text-emerald-600 dark:text-emerald-300" type="button">Зберегти</button>
                      <button onClick={() => setEditingItem(null)} className="text-sm font-semibold text-slate-500 dark:text-slate-400" type="button">Скасувати</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingItem({ id: item.id, quantity: item.quantity, min_quantity_alert: threshold(item) })} className="text-sm font-semibold text-blue-600 dark:text-blue-300" type="button">Редагувати</button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}
