import { useMemo, useState } from 'react';
import { useCustomerGroups } from '../hooks/useCustomerGroups';
import { useDeleteProductPrice, useProductPrices, useUpsertProductPrice } from '../hooks/useProductPrices';

/**
 * @param {{ productId: number | string, basePrice?: number }} props
 */
export default function ProductPricingTable({ productId, basePrice }) {
  const { data: groups = [] } = useCustomerGroups();
  const { data: prices = [], isLoading, isError } = useProductPrices(productId);
  const upsert = useUpsertProductPrice(productId);
  const remove = useDeleteProductPrice(productId);
  const [form, setForm] = useState({ customer_group_id: '', min_quantity: 1, price: '' });

  const canSubmit = useMemo(
    () => Number(form.customer_group_id) > 0 && Number(form.min_quantity) > 0 && Number(form.price) >= 0,
    [form]
  );

  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Роздрібна ціна за замовчуванням</p>
      <p className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-300">{basePrice ?? '—'} грн</p>

      <div className="mt-4 grid gap-2 md:grid-cols-4">
        <select
          className="form-input text-sm"
          value={form.customer_group_id}
          onChange={(e) => setForm((p) => ({ ...p, customer_group_id: e.target.value }))}
        >
          <option value="">Група клієнтів</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
        <input className="form-input text-sm" type="number" min="1" value={form.min_quantity} onChange={(e) => setForm((p) => ({ ...p, min_quantity: e.target.value }))} placeholder="Мін. кількість" />
        <input className="form-input text-sm" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} placeholder="Ціна" />
        <button
          type="button"
          disabled={!canSubmit || upsert.isPending}
          onClick={async () => {
            await upsert.mutateAsync({
              customer_group_id: Number(form.customer_group_id),
              min_quantity: Number(form.min_quantity),
              price: Number(form.price),
            });
            setForm({ customer_group_id: '', min_quantity: 1, price: '' });
          }}
          className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-amber-400 dark:text-slate-950"
        >
          Додати тариф
        </button>
      </div>

      {isLoading ? <p className="mt-4 text-sm text-slate-500">Завантаження тарифів...</p> : null}
      {isError ? <p className="mt-4 text-sm text-rose-600">Не вдалося завантажити тарифи.</p> : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10">
              <th className="px-2 py-2 text-left">Група клієнтів</th>
              <th className="px-2 py-2 text-left">Мін. кількість</th>
              <th className="px-2 py-2 text-left">Ціна</th>
              <th className="px-2 py-2 text-left">Дії</th>
            </tr>
          </thead>
          <tbody>
            {prices.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 dark:border-white/5">
                <td className="px-2 py-2">{row.customer_group_name || `#${row.customer_group_id}`}</td>
                <td className="px-2 py-2">{row.min_quantity}</td>
                <td className="px-2 py-2">{row.price}</td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => remove.mutate(row.id)}
                    className="text-rose-600 dark:text-rose-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

