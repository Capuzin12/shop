import React, { useEffect, useState } from 'react';
import api from '../../../api';
import { BackofficeShell, Panel, DataTable, LoadingState, StatusBadge } from '../components/BackofficeUI';
import InventoryAdjustForm from '../../../shared/components/InventoryAdjustForm';
import InventoryMovementsLog from '../../../shared/components/InventoryMovementsLog';
import { useRecentMovements } from '../../../shared/hooks/useInventoryAdjust';
// no auth hook needed here; route access controlled in AdminDashboard

export default function AdminStockReceiving({ onUpdate }) {
  const [inventory, setInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showLog, setShowLog] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { data: recentMovements, isLoading: movementsLoading } = useRecentMovements();

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/api/inventory');
      setInventory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchInventory(); }, []);

  const filteredInventory = inventory.filter(item => !searchTerm || item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) || item.product_sku?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <BackofficeShell
        eyebrow="Склад"
        title="Прийом товарів"
        description="Оформлюйте надходження, фіксуйте повернення та списання. Кожна операція логується автоматично."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr,400px]">
        <div className="space-y-4">
          <Panel title="Позиції складу" subtitle={`${filteredInventory.length} позицій`} actions={(
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Пошук по назві або SKU" className="form-input text-sm w-64" />
          )}>
            {isLoading ? <LoadingState /> : (
              <DataTable columns={['Товар','SKU','На складі','Поріг','Статус','Дії']}>
                {filteredInventory.map((item) => {
                  const isLow = item.quantity < (item.min_quantity_alert ?? item.min_quantity);
                  const isSelected = selectedItem?.id === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      <tr className={isSelected ? 'bg-amber-50/60 dark:bg-amber-500/10' : ''}>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{item.product_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">{item.product_sku}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">{item.min_quantity_alert ?? item.min_quantity}</td>
                        <td className="px-4 py-3"><StatusBadge tone={isLow ? 'rose' : 'emerald'}>{isLow ? 'Мало' : 'Норма'}</StatusBadge></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            <button type="button" onClick={() => setSelectedItem(isSelected ? null : item)} className={`rounded-2xl px-3 py-1.5 text-xs font-semibold transition ${isSelected ? 'bg-amber-400 text-slate-950' : 'bg-slate-950 text-white dark:bg-amber-400 dark:text-slate-950'}`}>{isSelected ? 'Закрити' : 'Коригувати'}</button>
                            <button type="button" onClick={() => setShowLog(showLog === item.id ? null : item.id)} className="rounded-2xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">{showLog === item.id ? 'Сховати лог' : 'Журнал'}</button>
                          </div>
                        </td>
                      </tr>

                      {isSelected && (
                        <tr>
                          <td colSpan={6} className="px-4 pb-4 pt-0">
                            <InventoryAdjustForm
                              item={item}
                              onSuccess={async () => {
                                setSelectedItem(null);
                                await fetchInventory();
                                onUpdate?.();
                              }}
                              onCancel={() => setSelectedItem(null)}
                            />
                          </td>
                        </tr>
                      )}

                      {showLog === item.id && (
                        <tr>
                          <td colSpan={6} className="px-4 pb-4 pt-0">
                            <InventoryMovementsLog inventoryId={item.id} enabled={showLog === item.id} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </DataTable>
            )}
          </Panel>
        </div>

        <div>
          <Panel title="Останні операції" subtitle="По всіх позиціях складу">
            {movementsLoading ? <LoadingState /> : (
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {(recentMovements || []).map((movement) => {
                  const isPositive = movement.quantity > 0;
                  const LABELS = { receipt: 'Прийом', return: 'Повернення', sale: 'Продаж', adjustment: 'Коригування', write_off: 'Списання' };
                  return (
                    <div key={movement.id} className="rounded-2xl border border-slate-200 p-3 dark:border-white/10">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{movement.product_name}</p>
                          <p className="text-xs text-slate-400">{movement.product_sku}</p>
                        </div>
                        <span className={`shrink-0 text-sm font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>{isPositive ? '+' : ''}{movement.quantity}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                        <span>{LABELS[movement.type] || movement.type}</span>
                        <span>{movement.created_at ? new Date(movement.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                      </div>
                      {movement.note && (<p className="mt-1 truncate text-xs italic text-slate-400">{movement.note}</p>)}
                      <p className="mt-1 text-xs text-slate-400">{movement.created_by_name} · стало: <span className="font-semibold text-slate-600 dark:text-slate-200">{movement.quantity_after}</span></p>
                    </div>
                  );
                })}
                {!recentMovements?.length && (<p className="text-sm text-slate-400 py-4 text-center">Операцій поки немає.</p>)}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}



