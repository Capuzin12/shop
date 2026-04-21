import api from '../../api';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, EmptyState, LoadingState, Panel, StatusBadge } from '../../components/BackofficeUI';
import { ROLE_LABELS } from '../../utils/roles';

export default function AdminUsers() {
  const { user, refreshUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ email: '', first_name: '', last_name: '', phone: '', role: 'customer', is_active: true, password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');

  const fetchUsers = async ({ showLoading = true } = {}) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await api.get('/api/users');
      const usersData = response.data;
      const validUsers = Array.isArray(usersData) 
        ? usersData.filter(u => u && u.id)
        : [];
      setUsers(validUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  };

  useEffect(() => {
    if (!user) return;
    const loadUsers = async () => {
      await fetchUsers();
    };
    loadUsers();
  }, [user]);

  const updateUser = async (itemId, payload) => {
    await api.put(`/api/users/${itemId}`, payload);
    if (itemId === user?.id) {
      await refreshUser?.();
    }
    await fetchUsers({ showLoading: false });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!editingUser) {
      setFormError('Спочатку натисніть «Повна форма» у рядку користувача.');
      return;
    }
    const nextErrors = {};
    const email = String(formData.email || '').trim();
    const firstName = String(formData.first_name || '').trim();
    const lastName = String(formData.last_name || '').trim();
    const phone = String(formData.phone || '').trim();
    if (!email) nextErrors.email = 'Вкажіть електронну пошту';
    if (!firstName) nextErrors.first_name = 'Вкажіть імʼя';
    if (!lastName) nextErrors.last_name = 'Вкажіть прізвище';
    if (!formData.role) nextErrors.role = 'Вкажіть роль';
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setFormError('Перевірте обовʼязкові поля користувача.');
      return;
    }

    setFormError('');
    try {
      const payload = {
        email,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        role: formData.role,
        is_active: Boolean(formData.is_active),
      };
      if (formData.password.trim()) payload.password = formData.password.trim();
      await updateUser(editingUser, payload);
      setEditingUser(null);
      setFormData({ email: '', first_name: '', last_name: '', phone: '', role: 'customer', is_active: true, password: '' });
      setFieldErrors({});
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setFormError(detail?.message || detail || 'Не вдалося зберегти користувача.');
    }
  };

  return (
    <div className="space-y-6">
    <Panel title="Користувачі" subtitle="Ролі, активність, контакти та пароль">
        {!editingUser ? <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Натисніть «Повна форма» у потрібному рядку, щоб відкрити повне редагування користувача.</p> : null}
      <form noValidate onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        {formError ? <p className="form-error-banner md:col-span-2">{formError}</p> : null}
        <div>
          <input value={formData.email} onChange={(e) => updateField('email', e.target.value)} placeholder="Електронна пошта *" className={`form-input ${fieldErrors.email ? 'form-input-error' : ''}`} />
          {fieldErrors.email ? <p className="form-error-text">{fieldErrors.email}</p> : null}
        </div>
        <div>
          <input value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="Телефон" className="form-input" />
        </div>
        <div>
          <input value={formData.first_name} onChange={(e) => updateField('first_name', e.target.value)} placeholder="Імʼя *" className={`form-input ${fieldErrors.first_name ? 'form-input-error' : ''}`} />
          {fieldErrors.first_name ? <p className="form-error-text">{fieldErrors.first_name}</p> : null}
        </div>
        <div>
          <input value={formData.last_name} onChange={(e) => updateField('last_name', e.target.value)} placeholder="Прізвище *" className={`form-input ${fieldErrors.last_name ? 'form-input-error' : ''}`} />
          {fieldErrors.last_name ? <p className="form-error-text">{fieldErrors.last_name}</p> : null}
        </div>
        <div>
          <select value={formData.role} onChange={(e) => updateField('role', e.target.value)} className={`form-input ${fieldErrors.role ? 'form-input-error' : ''}`}>
            <option value="customer">{ROLE_LABELS.customer}</option>
            <option value="content_manager">{ROLE_LABELS.content_manager}</option>
            <option value="warehouse_manager">{ROLE_LABELS.warehouse_manager}</option>
            <option value="sales_processor">{ROLE_LABELS.sales_processor}</option>
            <option value="manager">{ROLE_LABELS.manager}</option>
            <option value="admin">{ROLE_LABELS.admin}</option>
          </select>
          {fieldErrors.role ? <p className="form-error-text">{fieldErrors.role}</p> : null}
        </div>
        <div>
          <input value={formData.password} onChange={(e) => updateField('password', e.target.value)} placeholder="Новий пароль (необовʼязково)" className="form-input" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
          <input type="checkbox" checked={Boolean(formData.is_active)} onChange={(e) => updateField('is_active', e.target.checked)} />
          Активний користувач
        </label>
        <div className="md:col-span-2 flex flex-wrap gap-3">
          <button disabled={!editingUser} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-400 dark:text-slate-950" type="submit">
            {editingUser ? 'Зберегти зміни' : 'Зберегти'}
          </button>
          {editingUser ? <button onClick={() => { setEditingUser(null); setFormData({ email: '', first_name: '', last_name: '', phone: '', role: 'customer', is_active: true, password: '' }); setFieldErrors({}); setFormError(''); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" type="button">Скасувати</button> : null}
        </div>
      </form>
    </Panel>

    <Panel title="Список користувачів" subtitle="Редагуйте роль і статус або відкрийте повну форму вище">
      {isLoading ? (
        <LoadingState />
      ) : users.length === 0 ? (
        <EmptyState title="Користувачів не знайдено" text="Список з’явиться після реєстрацій або seed-даних." />
      ) : (
        <DataTable columns={['Електронна пошта', 'Імʼя', 'Роль', 'Статус', 'Дії']}>
          {users.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">{item.email}</td>
              <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{item.first_name} {item.last_name}</td>
              <td className="px-4 py-4">
                <select value={item.role} onChange={async (e) => { await updateUser(item.id, { role: e.target.value }); }} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/60">
                  <option value="customer">{ROLE_LABELS.customer}</option>
                  <option value="content_manager">{ROLE_LABELS.content_manager}</option>
                  <option value="warehouse_manager">{ROLE_LABELS.warehouse_manager}</option>
                  <option value="sales_processor">{ROLE_LABELS.sales_processor}</option>
                  <option value="manager">{ROLE_LABELS.manager}</option>
                  <option value="admin">{ROLE_LABELS.admin}</option>
                </select>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <StatusBadge tone={item.is_active ? 'emerald' : 'rose'}>{item.is_active ? 'Активний' : 'Неактивний'}</StatusBadge>
                  <select value={item.is_active ? 'active' : 'inactive'} onChange={async (e) => { await updateUser(item.id, { is_active: e.target.value === 'active' }); }} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/60">
                    <option value="active">Активний</option>
                    <option value="inactive">Неактивний</option>
                  </select>
                </div>
              </td>
              <td className="px-4 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingUser(item.id);
                    setFormData({
                      email: item.email || '',
                      first_name: item.first_name || '',
                      last_name: item.last_name || '',
                      phone: item.phone || '',
                      role: item.role || 'customer',
                      is_active: item.is_active !== false,
                      password: '',
                    });
                    setFormError('');
                    setFieldErrors({});
                  }}
                  className="text-sm font-semibold text-blue-600 dark:text-blue-300"
                >
                  Повна форма
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </Panel>
    </div>
  );
}
