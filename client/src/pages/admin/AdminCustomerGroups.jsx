import { useState } from 'react';
import {
  useCreateCustomerGroup,
  useCustomerGroups,
  useDeleteCustomerGroup,
  useUpdateCustomerGroup,
} from '../../hooks/useCustomerGroups';
import { DataTable, LoadingState, Panel } from '../../components/BackofficeUI';

const initialForm = { name: '', description: '', is_default: false };

export default function AdminCustomerGroups() {
  const { data = [], isLoading, isError } = useCustomerGroups();
  const createGroup = useCreateCustomerGroup();
  const updateGroup = useUpdateCustomerGroup();
  const deleteGroup = useDeleteCustomerGroup();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);

  return (
    <div className="space-y-6">
      <Panel title="Групи клієнтів" subtitle="Сегментація клієнтів для B2B ціноутворення">
        <div className="grid gap-2 md:grid-cols-4">
          <input className="form-input text-sm" placeholder="Назва" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <input className="form-input text-sm md:col-span-2" placeholder="Опис" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))} />
            Дефолтна
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-amber-400 dark:text-slate-950"
            onClick={async () => {
              if (!form.name.trim()) return;
              if (editing) {
                await updateGroup.mutateAsync({ id: editing, payload: form });
              } else {
                await createGroup.mutateAsync(form);
              }
              setEditing(null);
              setForm(initialForm);
            }}
          >
            {editing ? 'Зберегти' : 'Створити'}
          </button>
          {editing ? <button type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm dark:border-white/10" onClick={() => { setEditing(null); setForm(initialForm); }}>Скасувати</button> : null}
        </div>
      </Panel>

      <Panel title="Список груп" subtitle="Назва, опис, дефолтність, кількість користувачів">
        {isLoading ? <LoadingState /> : null}
        {isError ? <p className="text-sm text-rose-600">Не вдалося завантажити групи.</p> : null}
        {!isLoading && !isError ? (
          <DataTable columns={['Назва', 'Опис', 'Дефолтна', 'Кількість юзерів', 'Дії']}>
            {data.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{item.description || '—'}</td>
                <td className="px-4 py-3">{item.is_default ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-400/20 dark:text-amber-300">Default</span> : '—'}</td>
                <td className="px-4 py-3">{item.users_count}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 text-sm">
                    <button type="button" className="font-semibold text-blue-600 dark:text-blue-300" onClick={() => { setEditing(item.id); setForm({ name: item.name, description: item.description || '', is_default: Boolean(item.is_default) }); }}>Edit</button>
                    <button type="button" className="font-semibold text-rose-600 dark:text-rose-300" onClick={async () => {
                      if (!window.confirm('Видалити групу?')) return;
                      await deleteGroup.mutateAsync(item.id);
                    }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        ) : null}
      </Panel>
    </div>
  );
}

