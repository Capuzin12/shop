import api from '../api';
import { Boxes, LayoutGrid, PackageCheck, Shield, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { BackofficeShell, Panel, StatCard } from '../components/BackofficeUI';
import AdminCategories from './admin/AdminCategories';
import AdminInventory from './admin/AdminInventory';
import AdminOrders from './admin/AdminOrders';
import AdminProducts from './admin/AdminProducts';
import AdminUsers from './admin/AdminUsers';

const navItems = [
  { to: '/admin/products', label: 'Товари', icon: Boxes },
  { to: '/admin/categories', label: 'Категорії', icon: LayoutGrid },
  { to: '/admin/orders', label: 'Замовлення', icon: PackageCheck },
  { to: '/admin/users', label: 'Користувачі', icon: Users },
  { to: '/admin/inventory', label: 'Склад', icon: Shield },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState({});
  const location = useLocation();

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
      title="Адміністративна панель"
      description="Керуйте каталогом, користувачами, складом і замовленнями з одного центру управління."
      stats={[
        <StatCard key="categories" icon={LayoutGrid} label="Категорії" value={stats.categories || 0} tone="blue" />,
        <StatCard key="products" icon={Boxes} label="Товари" value={stats.products || 0} tone="amber" />,
        <StatCard key="orders" icon={PackageCheck} label="Замовлення" value={stats.orders || 0} tone="emerald" />,
      ]}
      sidebar={(
        <Panel title="Розділи" subtitle="Швидка навігація по адмінці">
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
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
      <Routes>
        <Route path="/products" element={<AdminProducts />} />
        <Route path="/categories" element={<AdminCategories />} />
        <Route path="/orders" element={<AdminOrders />} />
        <Route path="/users" element={<AdminUsers />} />
        <Route path="/inventory" element={<AdminInventory />} />
      </Routes>
    </BackofficeShell>
  );
}
