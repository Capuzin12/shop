import api from '../api';
import { Boxes, LayoutGrid, PackageCheck, Shield, TriangleAlert, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BackofficeShell, Panel, StatCard } from '../components/BackofficeUI';
import AdminCategories from './admin/AdminCategories';
import AdminInventory from './admin/AdminInventory';
import AdminOrders from './admin/AdminOrders';
import AdminProducts from './admin/AdminProducts';
import AdminUsers from './admin/AdminUsers';
import { useAuth } from '../contexts/AuthContext';
import { getRoleLabel, isStaffRole } from '../utils/roles';

const navItems = {
  admin: [
    { to: '/admin/products', label: 'Товари', icon: Boxes },
    { to: '/admin/categories', label: 'Категорії', icon: LayoutGrid },
    { to: '/admin/orders', label: 'Замовлення', icon: PackageCheck },
    { to: '/admin/users', label: 'Користувачі', icon: Users },
    { to: '/admin/inventory', label: 'Склад', icon: Shield },
  ],
  content_manager: [
    { to: '/admin/products', label: 'Товари', icon: Boxes },
    { to: '/admin/categories', label: 'Категорії', icon: LayoutGrid },
  ],
  manager: [
    { to: '/admin/products', label: 'Товари', icon: Boxes },
    { to: '/admin/categories', label: 'Категорії', icon: LayoutGrid },
    { to: '/admin/orders', label: 'Замовлення', icon: PackageCheck },
    { to: '/admin/inventory', label: 'Склад', icon: Shield },
  ],
  warehouse_manager: [
    { to: '/admin/inventory', label: 'Склад', icon: Shield },
  ],
  sales_processor: [
    { to: '/admin/orders', label: 'Замовлення', icon: PackageCheck },
  ],
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const location = useLocation();
  const currentRole = user?.role || 'customer';
  const availableNavItems = navItems[currentRole] || [];
  const firstSectionPath = availableNavItems[0]?.to;
  const roleLabel = getRoleLabel(currentRole);
  const hasOrdersAccess = availableNavItems.some((item) => item.to === '/admin/orders');
  const hasInventoryAccess = availableNavItems.some((item) => item.to === '/admin/inventory');

  const focusCards = [
    hasOrdersAccess
      ? {
          to: '/admin/orders',
          title: 'Замовлення в роботі',
          text: 'Переходьте одразу до обробки нових та активних заявок.',
          metric: stats.orders || 0,
          tone: 'amber',
        }
      : null,
    hasInventoryAccess
      ? {
          to: '/admin/inventory',
          title: 'Контроль складу',
          text: 'Відслідковуйте залишки та критичні пороги в один клік.',
          metric: stats.low_stock || 0,
          tone: 'rose',
        }
      : null,
    {
      to: firstSectionPath || '/admin',
      title: 'Швидкий старт',
      text: 'Відкрийте розділ, який ви використовуєте найчастіше.',
      metric: availableNavItems.length,
      tone: 'blue',
    },
  ].filter(Boolean);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/api/stats');
        setStats(response.data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <BackofficeShell
      eyebrow="Центр керування"
      title={`Адміністративна панель · ${roleLabel}`}
      description={isStaffRole(currentRole)
        ? 'Керуйте каталогом, користувачами, складом і замовленнями з одного центру управління.'
        : 'Доступ до backoffice обмежено вашою роллю.'}
      stats={[
        <StatCard key="categories" icon={LayoutGrid} label="Категорії" value={stats.categories || 0} tone="blue" />,
        <StatCard key="products" icon={Boxes} label="Товари" value={stats.products || 0} tone="amber" />,
        <StatCard key="orders" icon={PackageCheck} label="Замовлення" value={stats.orders || 0} tone="emerald" />,
        <StatCard key="low_stock" icon={TriangleAlert} label="Низький запас" value={stats.low_stock || 0} tone="rose" hint={(stats.low_stock || 0) > 0 ? 'Потребує уваги' : 'Критичних позицій немає'} />,
      ]}
      sidebar={(
        <Panel title="Розділи" subtitle="Швидка навігація по адмінці">
          <nav className="space-y-2">
            {availableNavItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? 'bg-slate-950 text-white dark:bg-amber-400 dark:text-slate-950'
                      : 'border border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:hover:border-white/10 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </Panel>
      )}
    >
      <div className="lg:hidden">
        <Panel title="Швидка навігація" subtitle="Найпопулярніші розділи під рукою">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {availableNavItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={`mobile-${item.to}`}
                  to={item.to}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-semibold ${
                    active
                      ? 'bg-slate-950 text-white dark:bg-amber-400 dark:text-slate-950'
                      : 'border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </Panel>
      </div>

      <Routes>
        <Route
          index
          element={(
            <div className="space-y-6">
              <Panel title="Фокус на сьогодні" subtitle="Найшвидші переходи для щоденних задач">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {focusCards.map((item) => (
                    <Link
                      key={item.title}
                      to={item.to}
                      className="rounded-[1.5rem] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg dark:border-white/10 dark:bg-white/5"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{item.title}</p>
                      <p className={`mt-3 text-3xl font-black ${item.tone === 'rose' ? 'text-rose-600 dark:text-rose-300' : item.tone === 'amber' ? 'text-amber-600 dark:text-amber-300' : 'text-blue-600 dark:text-blue-300'}`}>{item.metric}</p>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.text}</p>
                    </Link>
                  ))}
                </div>
              </Panel>

              <Panel
                title="Огляд робочого простору"
                subtitle="Оберіть розділ, який відповідає вашій ролі"
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {availableNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="flex h-full flex-col justify-between rounded-[1.5rem] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg dark:border-white/10 dark:bg-white/5 dark:hover:border-amber-400/40"
                      >
                        <div>
                          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                            <Icon className="h-5 w-5" />
                          </div>
                          <p className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{item.label}</p>
                        </div>
                        <span className="mt-6 text-sm font-semibold text-amber-700 dark:text-amber-300">Відкрити розділ →</span>
                      </Link>
                    );
                  })}
                </div>
              </Panel>
            </div>
          )}
        />
        {availableNavItems.some((item) => item.to === '/admin/products') && <Route path="products" element={<AdminProducts />} />}
        {availableNavItems.some((item) => item.to === '/admin/categories') && <Route path="categories" element={<AdminCategories />} />}
        {availableNavItems.some((item) => item.to === '/admin/orders') && <Route path="orders" element={<AdminOrders />} />}
        {availableNavItems.some((item) => item.to === '/admin/users') && <Route path="users" element={<AdminUsers />} />}
        {availableNavItems.some((item) => item.to === '/admin/inventory') && <Route path="inventory" element={<AdminInventory />} />}
        {firstSectionPath ? <Route path="*" element={<Navigate to={firstSectionPath.replace('/admin/', '')} replace />} /> : null}
      </Routes>
    </BackofficeShell>
  );
}
