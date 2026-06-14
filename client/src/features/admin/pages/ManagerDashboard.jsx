import api from '../../../api';
import { Boxes, LogOut, PackageCheck, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';
import { BackofficeShell, Panel, StatCard } from '../components/BackofficeUI';
import AdminStockReceiving from './AdminStockReceiving';
import ManagerInventory from './ManagerInventory';
import ManagerOrders from './ManagerOrders';
import ManagerProducts from './ManagerProducts';
import { getRoleLabel } from '../../../shared/utils/roles';

export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const preferredTab = ['sales_processor'].includes(user?.role) ? 'orders' : ['warehouse_manager'].includes(user?.role) ? 'inventory' : 'orders';
  const tabFromQuery = searchParams.get('tab');
  const [stats, setStats] = useState({ orders: 0, products: 0, lowStock: 0 });

  const canManageOrders = ['admin', 'manager', 'sales_processor'].includes(user?.role);
  const canManageInventory = ['admin', 'manager', 'warehouse_manager'].includes(user?.role);
  const canManageProducts = ['admin', 'manager', 'warehouse_manager'].includes(user?.role);
  const canManageReceiving = canManageInventory;
  const roleLabel = getRoleLabel(user?.role);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const [ordersRes, productsRes, inventoryRes] = await Promise.all([
        api.get('/api/staff/orders'),
        api.get('/api/products?limit=100'),
        api.get('/api/inventory'),
      ]);
      const orders = Array.isArray(ordersRes.data) ? ordersRes.data : (ordersRes.data.orders || []);
      const products = Array.isArray(productsRes.data) ? productsRes.data : (productsRes.data.products || []);
      const inventory = Array.isArray(inventoryRes.data) ? inventoryRes.data : [];
      const lowStock = inventory.filter((item) => item.quantity < (item.min_quantity_alert ?? item.min_quantity)).length;
      setStats({ orders: orders.length, products: products.length, lowStock });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats();
  }, [fetchStats]);

  if (!user || (!canManageOrders && !canManageInventory && !canManageProducts)) {
    return <div className="page-shell-comfy text-center text-slate-600 dark:text-slate-300">Ви не маєте доступу до панелі менеджера.</div>;
  }

  const tabs = [
    canManageOrders ? { id: 'orders', label: 'Замовлення' } : null,
    canManageProducts ? { id: 'products', label: 'Товари' } : null,
    canManageInventory ? { id: 'inventory', label: 'Склад' } : null,
    canManageReceiving ? { id: 'stock-receiving', label: 'Прийом товарів' } : null,
  ].filter(Boolean);

  const activeTab = tabFromQuery || preferredTab;
  const activeTabIsAllowed = tabs.some((tab) => tab.id === activeTab);
  const currentTab = activeTabIsAllowed ? activeTab : (tabs[0]?.id || 'orders');

  const switchTab = (tabId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tabId);
      return next;
    });
  };

  const sidebarNav = (
      <Panel title="Розділи" subtitle="Навігація панелі">
        <nav className="space-y-2">
          {tabs.map((tab) => {
            const active = currentTab === tab.id;
            const isAlert = tab.id === 'inventory' && stats.lowStock > 0;
            return (
                <button
                    key={tab.id}
                    type="button"
                    onClick={() => switchTab(tab.id)}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        active
                            ? 'bg-slate-950 text-white dark:bg-amber-400 dark:text-slate-950'
                            : 'border border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:hover:border-white/10 dark:hover:bg-white/5'
                    }`}
                >
                  {tab.label}
                  {isAlert && !active ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                  {stats.lowStock}
                </span>
                  ) : null}
                </button>
            );
          })}
        </nav>
      </Panel>
  );

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
                onClick={() => { logout(); navigate('/'); }}
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
          sidebar={sidebarNav}
      >
        {/* Mobile tab bar */}
        <div className="mb-4 lg:hidden">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {tabs.map((tab) => (
                <button
                    key={`mobile-${tab.id}`}
                    type="button"
                    onClick={() => switchTab(tab.id)}
                    className={`inline-flex items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-semibold ${
                        currentTab === tab.id
                            ? 'bg-slate-950 text-white dark:bg-amber-400 dark:text-slate-950'
                            : 'border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
                    }`}
                >
                  {tab.label}
                </button>
            ))}
          </div>
        </div>
        {currentTab === 'orders' && canManageOrders && <ManagerOrders onUpdate={fetchStats} />}
        {currentTab === 'products' && canManageProducts && <ManagerProducts />}
        {currentTab === 'inventory' && canManageInventory && <ManagerInventory onUpdate={fetchStats} />}
        {currentTab === 'stock-receiving' && canManageReceiving && <AdminStockReceiving onUpdate={fetchStats} />}
      </BackofficeShell>
  );
}