import api from '../../api';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, EmptyState, Panel, StatusBadge } from '../../components/BackofficeUI';

export default function AdminInventory() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [inventory, setInventory] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const rowRefs = useRef({});

  const targetInventoryId = Number(searchParams.get('inventory_id') || 0);
  const targetProductId = Number(searchParams.get('product_id') || 0);
  const highlightedRowId = inventory.find((item) =>
    (targetInventoryId && item.id === targetInventoryId)
    || (targetProductId && item.product_id === targetProductId)
  )?.id;

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
    if (!user) return;
    const loadInventory = async () => {
      await fetchInventory();
    };
    loadInventory();
  }, [user]);

  useEffect(() => {
    if (!inventory.length) return;
    if (!targetInventoryId && !targetProductId) return;

    const matched = inventory.find((item) => item.id === highlightedRowId);
    if (!matched) return;

    const timer = setTimeout(() => {
      rowRefs.current[matched.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [highlightedRowId, inventory, targetInventoryId, targetProductId]);

  const threshold = (item) => item.min_quantity_alert ?? item.min_quantity;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredInventory = inventory.filter((item) => {
    if (!normalizedSearch) return true;
    return (
      String(item.product_name || '').toLowerCase().includes(normalizedSearch)
      || String(item.product_sku || '').toLowerCase().includes(normalizedSearch)
      || String(item.location || '').toLowerCase().includes(normalizedSearch)
    );
  });

  return (
    <Panel title="Склад" subtitle="Порогові значення, запас і ручне коригування">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full gap-2 md:w-auto">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Пошук по назві, SKU або локації"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm md:w-80 dark:border-white/10 dark:bg-slate-950/60"
          />
          {searchTerm ? (
            <button
              onClick={() => setSearchTerm('')}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200"
              type="button"
            >
              Очистити
            </button>
          ) : null}
        </div>
      </div>

      {filteredInventory.length === 0 ? (
        <EmptyState title="Немає даних по складу" text="Перевірте seed або додайте товари до каталогу." />
      ) : (
        <DataTable columns={['Товар', 'Кількість', 'Мін / Макс', 'Поріг', 'Місце', 'Статус', 'Дії']}>
          {filteredInventory.map((item) => {
            const low = item.quantity < threshold(item);
            return (
              <tr
                key={item.id}
                ref={(node) => { rowRefs.current[item.id] = node; }}
                className={`${low ? 'bg-rose-50/60 dark:bg-rose-500/5' : ''} ${highlightedRowId === item.id ? 'ring-2 ring-amber-400 ring-inset dark:ring-amber-300' : ''}`}
              >
                <td className="px-4 py-4">
                  <p className="font-semibold text-slate-900 dark:text-white">{item.product_name}</p>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400">SKU: {item.product_sku || '—'}</p>
                </td>
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
