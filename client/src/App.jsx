import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './features/auth/context/AuthContext';
import ForgotPassword from './features/auth/pages/ForgotPassword';
import Login from './features/auth/pages/Login';
import Register from './features/auth/pages/Register';
import ResetPassword from './features/auth/pages/ResetPassword';
import AdminDashboard from './features/admin/pages/AdminDashboard';
import ManagerDashboard from './features/admin/pages/ManagerDashboard';
import Cart from './features/cart/pages/Cart';
import Checkout from './features/cart/pages/Checkout';
import Catalog from './features/catalog/pages/Catalog';
import ProductDetail from './features/catalog/pages/ProductDetail';
import Home from './features/home/pages/Home';
import { NotificationsProvider } from './features/notifications/context/NotificationsContext';
import Notifications from './features/notifications/pages/Notifications';
import Profile from './features/orders/pages/Profile';
import { CartProvider } from './features/cart/context/CartContext';
import { WishlistProvider } from './features/wishlist/context/WishlistContext';
import Wishlist from './features/wishlist/pages/Wishlist';
import AppErrorBoundary from './shared/components/AppErrorBoundary';
import GlobalToaster from './shared/components/GlobalToaster';
import Header from './shared/components/Header';
import ProtectedRoute from './shared/components/ProtectedRoute';
import { FeatureFlagProvider } from './shared/context/FeatureFlagContext';
import { ThemeProvider } from './shared/context/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FeatureFlagProvider>
          <WishlistProvider>
            <NotificationsProvider>
              <CartProvider>
                <AppErrorBoundary>
                  <div className="flex min-h-screen flex-col bg-transparent text-slate-900 transition-colors duration-300 dark:text-slate-100">
                    <Header />
                    <main className="flex-1 pb-12">
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/catalog" element={<Catalog />} />
                        <Route path="/product/:id" element={<ProductDetail />} />
                        <Route path="/cart" element={<Cart />} />
                        <Route path="/checkout" element={<Checkout />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/users/:userId" element={<Profile />} />
                        <Route path="/wishlist" element={<Wishlist />} />
                        <Route path="/notifications" element={<Notifications />} />
                        <Route
                          path="/admin/*"
                          element={(
                            <ProtectedRoute allowedRoles={['admin', 'content_manager', 'manager', 'warehouse_manager', 'sales_processor']}>
                              <AdminDashboard />
                            </ProtectedRoute>
                          )}
                        />
                        <Route
                          path="/manager/*"
                          element={(
                            <ProtectedRoute allowedRoles={['admin', 'manager', 'warehouse_manager', 'sales_processor']}>
                              <ManagerDashboard />
                            </ProtectedRoute>
                          )}
                        />
                      </Routes>
                    </main>
                    <GlobalToaster />
                  </div>
                </AppErrorBoundary>
              </CartProvider>
            </NotificationsProvider>
          </WishlistProvider>
        </FeatureFlagProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
