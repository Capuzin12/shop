import api from '../../api';
import { Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, EmptyState, LoadingState, Panel, StatusBadge } from '../../components/BackofficeUI';

const DEFAULT_FORM = {
  code: '',
  description: '',
  discount_type: 'percent',
  discount_value: '',
  min_order_amount: '0',
  max_uses: '',
  used_count: '0',
  valid_from: '',
  valid_until: '',
  is_active: true,
};

const toInputDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default function AdminPromoCodes() {
  const { user } = useAuth();
  const [promoCodes, setPromoCodes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const fetchPromoCodes = async ({ showLoading = true } = {}) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await api.get('/api/promo-codes');
      setPromoCodes(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching promo codes:', error);
      setPromoCodes([]);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchPromoCodes();
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    const code = String(formData.code || '').trim();
    const discountValue = Number(formData.discount_value);
    const minOrderAmount = Number(formData.min_order_amount || 0);
    const usedCount = Number(formData.used_count || 0);
    const maxUses = formData.max_uses === '' ? null : Number(formData.max_uses);
    const validFrom = formData.valid_from ? new Date(formData.valid_from) : null;
    const validUntil = formData.valid_until ? new Date(formData.valid_until) : null;

    if (!code) nextErrors.code = 'Вкажіть код промокоду';
    if (!Number.isFinite(discountValue) || discountValue < 0) nextErrors.discount_value = 'Вкажіть коректне значення знижки';
    if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) nextErrors.min_order_amount = 'Мінімальна сума не може бути відʼємною';
    if (!Number.isFinite(usedCount) || usedCount < 0) nextErrors.used_count = 'Кількість використань не може бути відʼємною';
    if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 0)) nextErrors.max_uses = 'Ліміт використань має бути коректним числом';

    if (code && !/^[A-Za-z0-9_-]+$/.test(code)) nextErrors.code = 'Код промокоду може містити лише літери, цифри, дефіс або підкреслення';
    if (formData.discount_type === 'percent' && Number.isFinite(discountValue) && discountValue > 100) nextErrors.discount_value = 'Відсоткова знижка не може бути більшою за 100%';
    if (maxUses !== null && Number.isFinite(maxUses) && maxUses < usedCount) nextErrors.max_uses = 'Максимум використань не може бути меншим за вже використані';
    if (validFrom && Number.isNaN(validFrom.getTime())) nextErrors.valid_from = 'Дата початку некоректна';
    if (validUntil && Number.isNaN(validUntil.getTime())) nextErrors.valid_until = 'Дата завершення некоректна';
    if (validFrom && validUntil && !Number.isNaN(validFrom.getTime()) && !Number.isNaN(validUntil.getTime()) && validUntil <= validFrom) nextErrors.valid_until = 'Дата завершення має бути пізнішою за дату початку';

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setFormError('Перевірте поля промокоду.');
      return;
    }

    setFormError('');
    try {
      const payload = {
        code,
        description: String(formData.description || '').trim() || null,
        discount_type: formData.discount_type,
        discount_value: discountValue,
        min_order_amount: minOrderAmount,
        max_uses: maxUses,
        used_count: usedCount,
        valid_from: formData.valid_from || null,
        valid_until: formData.valid_until || null,
        is_active: Boolean(formData.is_active),
      };
      if (editing) await api.put(`/api/promo-codes/${editing}`, payload);
      else await api.post('/api/promo-codes', payload);
      setEditing(null);
      setFormData(DEFAULT_FORM);
      setFieldErrors({});
      await fetchPromoCodes({ showLoading: false });
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setFormError(detail?.message || detail || 'Не вдалося зберегти промокод.');
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Промокоди"
        subtitle="Код, тип знижки, значення, обмеження та період дії"
        actions={<button onClick={() => fetchPromoCodes()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button"><RefreshCcw className="h-4 w-4" />Оновити</button>}
      >
        <form noValidate onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          {formError ? <p className="form-error-banner md:col-span-2">{formError}</p> : null}
          {Object.keys(fieldErrors).length ? (
            <div className="md:col-span-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {Object.values(fieldErrors).join(' ')}
            </div>
          ) : null}
          <div>
            <input value={formData.code} onChange={(e) => updateField('code', e.target.value)} placeholder="Код промокоду *" className={`form-input ${fieldErrors.code ? 'form-input-error' : ''}`} />
            {fieldErrors.code ? <p className="form-error-text">{fieldErrors.code}</p> : null}
          </div>
          <div>
            <select value={formData.discount_type} onChange={(e) => updateField('discount_type', e.target.value)} className="form-input">
              <option value="percent">Відсоткова знижка</option>
              <option value="fixed">Фіксована сума</option>
            </select>
          </div>
          <input value={formData.discount_value} onChange={(e) => updateField('discount_value', e.target.value)} placeholder="Значення знижки *" type="number" className={`form-input ${fieldErrors.discount_value ? 'form-input-error' : ''}`} />
          <input value={formData.min_order_amount} onChange={(e) => updateField('min_order_amount', e.target.value)} placeholder="Мінімальна сума замовлення" type="number" className={`form-input ${fieldErrors.min_order_amount ? 'form-input-error' : ''}`} />
          <input value={formData.max_uses} onChange={(e) => updateField('max_uses', e.target.value)} placeholder="Максимум використань" type="number" className={`form-input ${fieldErrors.max_uses ? 'form-input-error' : ''}`} />
          <input value={formData.used_count} onChange={(e) => updateField('used_count', e.target.value)} placeholder="Використано" type="number" className={`form-input ${fieldErrors.used_count ? 'form-input-error' : ''}`} />
          <input value={formData.valid_from} onChange={(e) => updateField('valid_from', e.target.value)} type="datetime-local" className="form-input" />
          <input value={formData.valid_until} onChange={(e) => updateField('valid_until', e.target.value)} type="datetime-local" className="form-input" />
          <textarea value={formData.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Опис" rows="3" className="form-input md:col-span-2" />
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
            <input type="checkbox" checked={Boolean(formData.is_active)} onChange={(e) => updateField('is_active', e.target.checked)} />
            Активний промокод
          </label>
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-amber-400 dark:text-slate-950" type="submit">
              <Plus className="h-4 w-4" />
              {editing ? 'Зберегти промокод' : 'Додати промокод'}
            </button>
            {editing ? <button onClick={() => { setEditing(null); setFormData(DEFAULT_FORM); setFieldErrors({}); setFormError(''); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button">Скасувати</button> : null}
          </div>
        </form>
      </Panel>

      <Panel title="Усі промокоди">
        {isLoading ? (
          <LoadingState />
        ) : promoCodes.length === 0 ? (
          <EmptyState title="Промокодів ще немає" text="Створіть перший промокод для акцій та знижок." />
        ) : (
          <DataTable columns={['Код', 'Тип', 'Значення', 'Використано', 'Статус', 'Дії']}>
            {promoCodes.map((promo) => (
              <tr key={promo.id}>
                <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">{promo.code}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{promo.discount_type === 'percent' ? 'Відсоткова' : 'Фіксована'}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{promo.discount_value}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{promo.used_count}/{promo.max_uses ?? '∞'}</td>
                <td className="px-4 py-4"><StatusBadge tone={promo.is_active ? 'emerald' : 'rose'}>{promo.is_active ? 'Активний' : 'Неактивний'}</StatusBadge></td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => { setEditing(promo.id); setFormData({ code: promo.code || '', description: promo.description || '', discount_type: promo.discount_type || 'percent', discount_value: String(promo.discount_value ?? ''), min_order_amount: String(promo.min_order_amount ?? 0), max_uses: promo.max_uses ?? '', used_count: String(promo.used_count ?? 0), valid_from: toInputDateTime(promo.valid_from), valid_until: toInputDateTime(promo.valid_until), is_active: promo.is_active !== false }); }} className="text-sm font-semibold text-blue-600 dark:text-blue-300" type="button">Редагувати</button>
                    <button onClick={async () => { if (!confirm('Видалити промокод?')) return; await api.delete(`/api/promo-codes/${promo.id}`); await fetchPromoCodes({ showLoading: false }); }} className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 dark:text-rose-300" type="button"><Trash2 className="h-4 w-4" />Видалити</button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}


