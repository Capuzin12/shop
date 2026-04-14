import api from '../../api';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, EmptyState, Panel, StatusBadge } from '../../components/BackofficeUI';

const ROLE_LABELS = {
  customer: 'Клієнт',
  manager: 'Менеджер',
  admin: 'Адміністратор',
};

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);

  const fetchUsers = async () => {
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
    }
  };

  useEffect(() => {
    if (!user?.token) return;
    const loadUsers = async () => {
      await fetchUsers();
    };
    loadUsers();
  }, [user?.token]);

  return (
    <Panel title="Користувачі" subtitle="Ролі, активність та контроль доступу">
      {users.length === 0 ? (
        <EmptyState title="Користувачів не знайдено" text="Список з’явиться після реєстрацій або seed-даних." />
      ) : (
        <DataTable columns={['Email', 'Ім’я', 'Роль', 'Статус']}>
          {users.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">{item.email}</td>
              <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{item.first_name} {item.last_name}</td>
              <td className="px-4 py-4">
                <select value={item.role} onChange={async (e) => { await api.put(`/api/users/${item.id}`, { role: e.target.value }); fetchUsers(); }} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/60">
                  <option value="customer">{ROLE_LABELS.customer}</option>
                  <option value="manager">{ROLE_LABELS.manager}</option>
                  <option value="admin">{ROLE_LABELS.admin}</option>
                </select>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <StatusBadge tone={item.is_active ? 'emerald' : 'rose'}>{item.is_active ? 'Активний' : 'Неактивний'}</StatusBadge>
                  <select value={item.is_active ? 'active' : 'inactive'} onChange={async (e) => { await api.put(`/api/users/${item.id}`, { is_active: e.target.value === 'active' }); fetchUsers(); }} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/60">
                    <option value="active">Активний</option>
                    <option value="inactive">Неактивний</option>
                  </select>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </Panel>
  );
}
