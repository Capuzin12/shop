import api from '../../api';
import { Boxes, LogOut, PackageCheck, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { BackofficeShell, FilterButton, Panel, StatCard } from '../../components/BackofficeUI';
import ManagerInventory from './ManagerInventory';
import ManagerOrders from './ManagerOrders';
import ManagerProducts from './ManagerProducts';
import { getRoleLabel } from '../../utils/roles';

export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const preferredTab = ['sales_processor'].includes(user?.role)
    ? 'orders'
    : ['warehouse_manager'].includes(user?.role)
      ? 'inventory'
      : 'orders';
  const tabFromQuery = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromQuery || preferredTab);
  const [stats, setStats] = useState({ orders: 0, products: 0, lowStock: 0 });

  const canManageOrders = ['admin', 'manager', 'sales_processor'].includes(user?.role);
  const canManageInventory = ['admin', 'manager', 'warehouse_manager'].includes(user?.role);
  const canManageProducts = ['admin', 'manager', 'warehouse_manager'].includes(user?.role);
  const roleLabel = getRoleLabel(user?.role);

  const fetchStats = async () => {
    if (!user?.token) return;
    try {
      const [ordersRes, productsRes, inventoryRes] = await Promise.all([
        api.get('/api/orders'),
        api.get('/api/products?limit=100'),
        api.get('/api/inventory'),
      ]);

      const ordersData = ordersRes.data;
      const productsData = productsRes.data;
      const inventoryData = inventoryRes.data;

      const orders = Array.isArray(ordersData) ? ordersData : (ordersData.orders || []);
      const products = Array.isArray(productsData) ? productsData : (productsData.products || []);
      const inventory = Array.isArray(inventoryData) ? inventoryData : [];
      const lowStock = inventory.filter((item) => item.quantity < (item.min_quantity_alert ?? item.min_quantity)).length;

      setStats({ orders: orders.length, products: products.length, lowStock });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    if (tabFromQuery) {
      setActiveTab(tabFromQuery);
      return;
    }
    setActiveTab(preferredTab);
  }, [preferredTab, tabFromQuery]);

  useEffect(() => {
    fetchStats();
  }, [user?.token]);

  if (!user || (!canManageOrders && !canManageInventory && !canManageProducts)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-center text-slate-600 dark:text-slate-300">
        Ви не маєте доступу до панелі менеджера.
      </div>
    );
  }

  const tabs = [
    canManageOrders ? { id: 'orders', label: 'Замовлення' } : null,
    canManageProducts ? { id: 'products', label: 'Товари' } : null,
    canManageInventory ? { id: 'inventory', label: 'Склад' } : null,
  ].filter(Boolean);

  const switchTab = (tabId) => {
    setActiveTab(tabId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tabId);
      return next;
    });
  };

  const activeTabIsAllowed = tabs.some((tab) => tab.id === activeTab);
  const currentTab = activeTabIsAllowed ? activeTab : (tabs[0]?.id || 'orders');

  return (
    <BackofficeShell
      eyebrow="Панель операцій"
      title={`Панель менеджера · ${roleLabel}`}
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
        subtitle="Перемикайтеся між ключовими задачами менеджера без дублювання блоків"
        actions={tabs.map((tab) => (
          <FilterButton key={tab.id} active={currentTab === tab.id} alert={tab.id === 'inventory' && stats.lowStock > 0} onClick={() => switchTab(tab.id)}>
            {tab.label}
          </FilterButton>
        ))}
      >
        {currentTab === 'orders' && canManageOrders && <ManagerOrders onUpdate={fetchStats} />}
        {currentTab === 'products' && canManageProducts && <ManagerProducts />}
        {currentTab === 'inventory' && canManageInventory && <ManagerInventory onUpdate={fetchStats} />}
      </Panel>
    </BackofficeShell>
  );
}
