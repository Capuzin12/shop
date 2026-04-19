import api from '../../api';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable, EmptyState, Panel, StatusBadge } from '../../components/BackofficeUI';
import { ROLE_LABELS } from '../../utils/roles';

export default function AdminUsers() {
  const { user, refreshUser } = useAuth();
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
    await fetchUsers();
  };

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
            </tr>
          ))}
        </DataTable>
      )}
    </Panel>
  );
}
