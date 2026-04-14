import api from '../../api';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, EmptyState, Panel, StatusBadge } from '../../components/BackofficeUI';

export default function AdminInventory() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [editingId, setEditingId] = useState(null);

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

  useEffect(() => {
    if (!user?.token) return;
    const loadInventory = async () => {
      await fetchInventory();
    };
    loadInventory();
  }, [user?.token]);

  const threshold = (item) => item.min_quantity_alert ?? item.min_quantity;

  return (
    <Panel title="Склад" subtitle="Порогові значення, запас і ручне коригування">
      {inventory.length === 0 ? (
        <EmptyState title="Немає даних по складу" text="Перевірте seed або додайте товари до каталогу." />
      ) : (
        <DataTable columns={['Товар', 'Кількість', 'Мін / Макс', 'Поріг', 'Місце', 'Статус', 'Дії']}>
          {inventory.map((item) => {
            const low = item.quantity < threshold(item);
            return (
              <tr key={item.id} className={low ? 'bg-rose-50/60 dark:bg-rose-500/5' : ''}>
                <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">{item.product_name}</td>
                <td className="px-4 py-4">
                  {editingId === item.id ? <input defaultValue={item.quantity} onChange={(e) => setInventory((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, quantity: parseInt(e.target.value, 10) || 0 } : entry))} className="w-24 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/60" type="number" /> : <span className="font-semibold text-slate-900 dark:text-white">{item.quantity}</span>}
                </td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{item.min_quantity} / {item.max_quantity}</td>
                <td className="px-4 py-4">
                  {editingId === item.id ? <input defaultValue={threshold(item)} onChange={(e) => setInventory((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, min_quantity_alert: parseInt(e.target.value, 10) || 0 } : entry))} className="w-24 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/60" type="number" /> : <span className="text-sm text-slate-500 dark:text-slate-400">{threshold(item)}</span>}
                </td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{item.location || '—'}</td>
                <td className="px-4 py-4">{low ? <StatusBadge tone="rose">Низький запас</StatusBadge> : <StatusBadge tone="emerald">У нормі</StatusBadge>}</td>
                <td className="px-4 py-4">
                  {editingId === item.id ? (
                    <div className="flex gap-3">
                      <button onClick={async () => { const current = inventory.find((entry) => entry.id === item.id); await api.put(`/api/inventory/${item.id}`, { quantity: current.quantity, min_quantity: current.min_quantity, min_quantity_alert: current.min_quantity_alert }); setEditingId(null); fetchInventory(); }} className="text-sm font-semibold text-emerald-600 dark:text-emerald-300" type="button">Зберегти</button>
                      <button onClick={() => setEditingId(null)} className="text-sm font-semibold text-slate-500 dark:text-slate-400" type="button">Скасувати</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingId(item.id)} className="text-sm font-semibold text-blue-600 dark:text-blue-300" type="button">Редагувати</button>
                  )}
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </Panel>
  );
}
