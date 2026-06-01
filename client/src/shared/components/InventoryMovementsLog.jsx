import React from 'react';
import { useInventoryMovements } from '../hooks/useInventoryAdjust';

export default function InventoryMovementsLog({ inventoryId, enabled }) {
  const { data, isLoading } = useInventoryMovements(inventoryId, enabled);

  const MOVEMENT_LABELS = {
    receipt:    { label: 'Прийом',      tone: 'emerald', sign: '+' },
    return:     { label: 'Повернення',  tone: 'blue',    sign: '+' },
    sale:       { label: 'Продаж',      tone: 'slate',   sign: '-' },
    adjustment: { label: 'Коригування', tone: 'amber',   sign: '±' },
    write_off:  { label: 'Списання',    tone: 'rose',    sign: '-' },
  };

  if (!enabled) return null;
  if (isLoading) return <p className="text-sm text-slate-500 py-2">Завантаження журналу...</p>;
  if (!data?.items?.length) return (
    <p className="text-sm text-slate-400 dark:text-slate-500 py-2 italic">Операцій ще немає.</p>
  );

  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-950/60">
          <tr>
            {['Дата', 'Тип', 'Зміна', 'Стало', 'Коментар'].map(col => (
              <th key={col} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {data.items.map((movement) => {
            const meta = MOVEMENT_LABELS[movement.type] || MOVEMENT_LABELS.adjustment;
            const isPositive = movement.quantity > 0;
            return (
              <tr key={movement.id}>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{movement.created_at ? new Date(movement.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    meta.tone === 'emerald' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' :
                    meta.tone === 'blue'    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' :
                    meta.tone === 'amber'   ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' :
                    meta.tone === 'rose'    ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' :
                                              'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                  }`}>{meta.label}</span>
                </td>
                <td className={`px-3 py-2 font-semibold ${isPositive ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>{isPositive ? '+' : ''}{movement.quantity}</td>
                <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">{movement.quantity_after}</td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{movement.note || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

