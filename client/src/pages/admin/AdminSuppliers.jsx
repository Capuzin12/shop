import api from '../../api';
import { Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, EmptyState, LoadingState, Panel, StatusBadge } from '../../components/BackofficeUI';
import { isValidEmail, isValidPhone } from '../../utils/validation';

const DEFAULT_FORM = {
  name: '',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  payment_terms: '',
  notes: '',
  is_active: true,
};

export default function AdminSuppliers() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
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

  const fetchSuppliers = async ({ showLoading = true } = {}) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await api.get('/api/suppliers');
      setSuppliers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setSuppliers([]);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchSuppliers();
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    const name = String(formData.name || '').trim();
    const contactName = String(formData.contact_name || '').trim();
    const phone = String(formData.phone || '').trim();
    const email = String(formData.email || '').trim();
    if (!name) nextErrors.name = 'Вкажіть назву постачальника';

    if (contactName && contactName.length < 2) nextErrors.contact_name = 'Контактна особа має містити щонайменше 2 символи';
    if (phone && !isValidPhone(phone)) nextErrors.phone = 'Вкажіть телефон у коректному форматі';
    if (email && !isValidEmail(email)) nextErrors.email = 'Вкажіть коректну електронну пошту';

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setFormError('Перевірте обовʼязкові поля постачальника.');
      return;
    }

    setFormError('');
    try {
      const payload = {
        name,
        contact_name: contactName || null,
        phone: phone || null,
        email: email || null,
        address: String(formData.address || '').trim() || null,
        payment_terms: String(formData.payment_terms || '').trim() || null,
        notes: String(formData.notes || '').trim() || null,
        is_active: Boolean(formData.is_active),
      };
      if (editing) await api.put(`/api/suppliers/${editing}`, payload);
      else await api.post('/api/suppliers', payload);
      setEditing(null);
      setFormData(DEFAULT_FORM);
      setFieldErrors({});
      await fetchSuppliers({ showLoading: false });
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setFormError(detail?.message || detail || 'Не вдалося зберегти постачальника.');
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Постачальники"
        subtitle="Контакти, умови оплати, адреса та примітки постачальників"
        actions={<button onClick={() => fetchSuppliers()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button"><RefreshCcw className="h-4 w-4" />Оновити</button>}
      >
        <form noValidate onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          {formError ? <p className="form-error-banner md:col-span-2">{formError}</p> : null}
          {Object.keys(fieldErrors).length ? (
            <div className="md:col-span-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {Object.values(fieldErrors).join(' ')}
            </div>
          ) : null}
          <div>
            <input value={formData.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Назва постачальника *" className={`form-input ${fieldErrors.name ? 'form-input-error' : ''}`} />
            {fieldErrors.name ? <p className="form-error-text">{fieldErrors.name}</p> : null}
          </div>
          <input value={formData.contact_name} onChange={(e) => updateField('contact_name', e.target.value)} placeholder="Контактна особа" className="form-input" />
          <input value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="Телефон" className="form-input" />
          <input value={formData.email} onChange={(e) => updateField('email', e.target.value)} placeholder="Електронна пошта" className="form-input" />
          <input value={formData.payment_terms} onChange={(e) => updateField('payment_terms', e.target.value)} placeholder="Умови оплати" className="form-input md:col-span-2" />
          <textarea value={formData.address} onChange={(e) => updateField('address', e.target.value)} placeholder="Адреса" rows="3" className="form-input md:col-span-2" />
          <textarea value={formData.notes} onChange={(e) => updateField('notes', e.target.value)} placeholder="Примітки" rows="3" className="form-input md:col-span-2" />
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
            <input type="checkbox" checked={Boolean(formData.is_active)} onChange={(e) => updateField('is_active', e.target.checked)} />
            Активний постачальник
          </label>
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-amber-400 dark:text-slate-950" type="submit">
              <Plus className="h-4 w-4" />
              {editing ? 'Зберегти постачальника' : 'Додати постачальника'}
            </button>
            {editing ? <button onClick={() => { setEditing(null); setFormData(DEFAULT_FORM); setFieldErrors({}); setFormError(''); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button">Скасувати</button> : null}
          </div>
        </form>
      </Panel>

      <Panel title="Усі постачальники">
        {isLoading ? (
          <LoadingState />
        ) : suppliers.length === 0 ? (
          <EmptyState title="Постачальників ще немає" text="Додайте першого постачальника." />
        ) : (
          <DataTable columns={['Назва', 'Контакт', 'Телефон', 'Статус', 'Дії']}>
            {suppliers.map((supplier) => (
              <tr key={supplier.id}>
                <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">{supplier.name}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{supplier.contact_name || '—'}</td>
                <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{supplier.phone || '—'}</td>
                <td className="px-4 py-4"><StatusBadge tone={supplier.is_active ? 'emerald' : 'rose'}>{supplier.is_active ? 'Активний' : 'Неактивний'}</StatusBadge></td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => { setEditing(supplier.id); setFormData({ name: supplier.name || '', contact_name: supplier.contact_name || '', phone: supplier.phone || '', email: supplier.email || '', address: supplier.address || '', payment_terms: supplier.payment_terms || '', notes: supplier.notes || '', is_active: supplier.is_active !== false }); }} className="text-sm font-semibold text-blue-600 dark:text-blue-300" type="button">Редагувати</button>
                    <button onClick={async () => { if (!confirm('Видалити постачальника?')) return; await api.delete(`/api/suppliers/${supplier.id}`); await fetchSuppliers({ showLoading: false }); }} className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 dark:text-rose-300" type="button"><Trash2 className="h-4 w-4" />Видалити</button>
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



