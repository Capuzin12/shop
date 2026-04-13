import api from '../../api';
import { Boxes, LogOut, PackageCheck, ShieldAlert, Warehouse } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { BackofficeShell, FilterButton, Panel, StatCard } from '../../components/BackofficeUI';
import ManagerInventory from './ManagerInventory';
import ManagerOrders from './ManagerOrders';
import ManagerProducts from './ManagerProducts';

export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('orders');
  const [stats, setStats] = useState({ orders: 0, products: 0, lowStock: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.token) return;
      try {
        const [ordersRes, productsRes, inventoryRes] = await Promise.all([
          api.get('/api/orders'),
          api.get('/api/products?limit=100'),
          api.get('/api/inventory'),
        ]);

        const orders = Array.isArray(ordersRes.data) ? ordersRes.data : ordersRes.data.orders || [];
        const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data.products || [];
        const inventory = Array.isArray(inventoryRes.data) ? inventoryRes.data : [];
        const lowStock = inventory.filter((item) => item.quantity < (item.min_quantity_alert ?? item.min_quantity)).length;

        setStats({ orders: orders.length, products: products.length, lowStock });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, [user?.token]);

  if (!user || (user.role !== 'manager' && user.role !== 'admin')) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-center text-slate-600 dark:text-slate-300">
        Ви не маєте доступу до панелі менеджера.
      </div>
    );
  }

  const tabs = [
    { id: 'orders', label: 'Замовлення' },
    { id: 'products', label: 'Товари' },
    { id: 'inventory', label: 'Склад' },
  ];

  return (
    <BackofficeShell
      eyebrow="Панель операцій"
      title="Панель менеджера"
      description="Операційний екран для щоденної роботи із замовленнями, товарами та контролем запасів."
      actions={[
        <div key="user" className="rounded-2xl border border-white/50 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
          <p className="font-semibold text-slate-900 dark:text-white">{user.first_name || 'Менеджер'}</p>
          <p>{user.email}</p>
        </div>,
        <button
          key="logout"
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/10"
          type="button"
        >
          <LogOut className="h-4 w-4" />
          Вийти
        </button>,
      ]}
      stats={[
        <StatCard key="orders" icon={PackageCheck} label="Замовлення" value={stats.orders} tone="blue" />,
        <StatCard key="products" icon={Boxes} label="Товари" value={stats.products} tone="amber" />,
        <StatCard key="low-stock" icon={ShieldAlert} label="Низький запас" value={stats.lowStock} tone="rose" hint={stats.lowStock ? 'Потребує уваги' : 'Все стабільно'} />,
      ]}
    >
      <Panel
        title="Робочі розділи"
        subtitle="Перемикайтеся між ключовими задачами менеджера"
        actions={tabs.map((tab) => (
          <FilterButton key={tab.id} active={activeTab === tab.id} alert={tab.id === 'inventory' && stats.lowStock > 0} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </FilterButton>
        ))}
      >
        {activeTab === 'orders' && <ManagerOrders onUpdate={() => setStats((prev) => ({ ...prev }))} />}
        {activeTab === 'products' && <ManagerProducts />}
        {activeTab === 'inventory' && <ManagerInventory />}
      </Panel>
    </BackofficeShell>
  );
}
