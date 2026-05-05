import { useState } from 'react';
import { useProductPriceHistory } from '../hooks/usePriceHistory';

/**
 * @param {{ productId: number | string }} props
 */
export default function PriceHistoryLog({ productId }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useProductPriceHistory(productId, page);
  const items = data?.items || [];

  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">Історія змін ціни</p>

      {isLoading ? <p className="mt-3 text-sm text-slate-500">Завантаження...</p> : null}
      {isError ? <p className="mt-3 text-sm text-rose-600">Не вдалося завантажити журнал.</p> : null}

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10">
              <th className="px-2 py-2 text-left">Дата</th>
              <th className="px-2 py-2 text-left">Стара ціна</th>
              <th className="px-2 py-2 text-left">Нова ціна</th>
              <th className="px-2 py-2 text-left">Різниця</th>
              <th className="px-2 py-2 text-left">Змінив</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const delta = Number(item.new_price) - Number(item.old_price);
              return (
                <tr key={item.id} className="border-b border-slate-100 dark:border-white/5">
                  <td className="px-2 py-2">{item.changed_at ? new Date(item.changed_at).toLocaleString('uk-UA') : '—'}</td>
                  <td className="px-2 py-2">{item.old_price}</td>
                  <td className="px-2 py-2">{item.new_price}</td>
                  <td className={`px-2 py-2 font-semibold ${delta >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(2)}</td>
                  <td className="px-2 py-2">{item.changed_by_name || 'Система'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-xl border border-slate-200 px-3 py-1 dark:border-white/10">Назад</button>
        <span>Сторінка {page}</span>
        <button type="button" onClick={() => setPage((p) => p + 1)} className="rounded-xl border border-slate-200 px-3 py-1 dark:border-white/10">Далі</button>
      </div>
    </div>
  );
}

