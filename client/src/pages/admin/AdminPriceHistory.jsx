import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable, Panel } from '../../components/BackofficeUI';
import { useGlobalPriceHistory } from '../../hooks/usePriceHistory';

export default function AdminPriceHistory() {
  const [filters, setFilters] = useState({ page: 1, per_page: 20, product_id: '', changed_by: '', date_from: '', date_to: '' });
  const { data, isLoading, isError } = useGlobalPriceHistory(filters);
  const items = data?.items || [];

  return (
    <div className="space-y-6">
      <Panel title="Глобальний журнал змін цін" subtitle="Фільтруйте по товару, адміну та даті">
        <div className="grid gap-2 md:grid-cols-5">
          <input className="form-input text-sm" placeholder="ID товару" value={filters.product_id} onChange={(e) => setFilters((p) => ({ ...p, product_id: e.target.value, page: 1 }))} />
          <input className="form-input text-sm" placeholder="ID адміна" value={filters.changed_by} onChange={(e) => setFilters((p) => ({ ...p, changed_by: e.target.value, page: 1 }))} />
          <input className="form-input text-sm" type="date" value={filters.date_from} onChange={(e) => setFilters((p) => ({ ...p, date_from: e.target.value, page: 1 }))} />
          <input className="form-input text-sm" type="date" value={filters.date_to} onChange={(e) => setFilters((p) => ({ ...p, date_to: e.target.value, page: 1 }))} />
          <button type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm dark:border-white/10" onClick={() => setFilters({ page: 1, per_page: 20, product_id: '', changed_by: '', date_from: '', date_to: '' })}>Скинути</button>
        </div>
      </Panel>

      <Panel title="Зміни цін" subtitle={`Усього: ${data?.total || 0}`}>
        {isLoading ? <p className="text-sm text-slate-500">Завантаження...</p> : null}
        {isError ? <p className="text-sm text-rose-600">Не вдалося завантажити журнал.</p> : null}
        {!isLoading && !isError ? (
          <DataTable columns={['Дата', 'Товар', 'Стара', 'Нова', 'Різниця', 'Змінив']}>
            {items.map((item) => {
              const delta = Number(item.new_price) - Number(item.old_price);
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{item.changed_at ? new Date(item.changed_at).toLocaleString('uk-UA') : '—'}</td>
                  <td className="px-4 py-3">
                    <Link to="/admin/products" className="font-semibold text-blue-600 dark:text-blue-300">{item.product_name || `#${item.product_id}`}</Link>
                  </td>
                  <td className="px-4 py-3">{item.old_price}</td>
                  <td className="px-4 py-3">{item.new_price}</td>
                  <td className={`px-4 py-3 font-semibold ${delta >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(2)}</td>
                  <td className="px-4 py-3">{item.changed_by_name || 'Система'}</td>
                </tr>
              );
            })}
          </DataTable>
        ) : null}

        <div className="mt-3 flex items-center justify-between text-sm">
          <button type="button" className="rounded-xl border border-slate-200 px-3 py-1 dark:border-white/10" onClick={() => setFilters((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}>Назад</button>
          <span>Сторінка {filters.page}</span>
          <button type="button" className="rounded-xl border border-slate-200 px-3 py-1 dark:border-white/10" onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}>Далі</button>
        </div>
      </Panel>
    </div>
  );
}

