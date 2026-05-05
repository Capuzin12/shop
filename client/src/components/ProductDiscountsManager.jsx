import { useMemo, useState } from 'react';
import { useCreateDiscount, useDeleteDiscount, useProductDiscounts } from '../hooks/useProductDiscounts';

const initialForm = {
  discount_type: 'PERCENTAGE',
  discount_value: '',
  start_date: '',
  end_date: '',
  is_active: true,
};

/**
 * @param {{ productId: number | string }} props
 */
export default function ProductDiscountsManager({ productId }) {
  const { data = [], isLoading, isError } = useProductDiscounts(productId);
  const createDiscount = useCreateDiscount(productId);
  const deleteDiscount = useDeleteDiscount(productId);
  const [form, setForm] = useState(initialForm);

  const canSave = useMemo(() => Number(form.discount_value) > 0, [form.discount_value]);

  const statusLabel = (item) => {
    if (item.is_currently_active) return 'Активна';
    if (item.start_date && new Date(item.start_date) > new Date()) return 'Запланована';
    if (item.end_date && new Date(item.end_date) < new Date()) return 'Завершена';
    return item.is_active ? 'Активна' : 'Неактивна';
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">Акції та знижки</p>

      <div className="mt-3 grid gap-2 md:grid-cols-5">
        <select className="form-input text-sm" value={form.discount_type} onChange={(e) => setForm((p) => ({ ...p, discount_type: e.target.value }))}>
          <option value="PERCENTAGE">PERCENTAGE</option>
          <option value="FIXED_PRICE">FIXED_PRICE</option>
        </select>
        <input className="form-input text-sm" type="number" min="0" step="0.01" placeholder="Значення" value={form.discount_value} onChange={(e) => setForm((p) => ({ ...p, discount_value: e.target.value }))} />
        <input className="form-input text-sm" type="datetime-local" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
        <input className="form-input text-sm" type="datetime-local" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
        <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
          Активна
        </label>
      </div>

      <button
        type="button"
        disabled={!canSave || createDiscount.isPending}
        onClick={async () => {
          await createDiscount.mutateAsync({
            ...form,
            discount_value: Number(form.discount_value),
            start_date: form.start_date || null,
            end_date: form.end_date || null,
          });
          setForm(initialForm);
        }}
        className="mt-3 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-amber-400 dark:text-slate-950"
      >
        Додати знижку
      </button>

      {isLoading ? <p className="mt-4 text-sm text-slate-500">Завантаження знижок...</p> : null}
      {isError ? <p className="mt-4 text-sm text-rose-600">Не вдалося завантажити знижки.</p> : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10">
              <th className="px-2 py-2 text-left">Тип</th>
              <th className="px-2 py-2 text-left">Значення</th>
              <th className="px-2 py-2 text-left">Початок</th>
              <th className="px-2 py-2 text-left">Кінець</th>
              <th className="px-2 py-2 text-left">Статус</th>
              <th className="px-2 py-2 text-left">Дії</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 dark:border-white/5">
                <td className="px-2 py-2">{item.discount_type}</td>
                <td className="px-2 py-2">{item.discount_value}</td>
                <td className="px-2 py-2">{item.start_date ? new Date(item.start_date).toLocaleString('uk-UA') : '—'}</td>
                <td className="px-2 py-2">{item.end_date ? new Date(item.end_date).toLocaleString('uk-UA') : '—'}</td>
                <td className="px-2 py-2">{statusLabel(item)}</td>
                <td className="px-2 py-2">
                  <button type="button" onClick={() => deleteDiscount.mutate(item.id)} className="text-rose-600 dark:text-rose-300">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

