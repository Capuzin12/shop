import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { WishlistProvider } from './contexts/WishlistContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import Header from './components/Header';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Wishlist from './pages/Wishlist';
import Notifications from './pages/Notifications';
import AdminDashboard from './pages/AdminDashboard';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WishlistProvider>
          <NotificationsProvider>
            <CartProvider>
              <div className="min-h-screen bg-transparent text-slate-900 transition-colors duration-300 dark:text-slate-100">
                <Header />
                <main className="pb-12">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/catalog" element={<Catalog />} />
                    <Route path="/product/:id" element={<ProductDetail />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/wishlist" element={<Wishlist />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/admin/*" element={
                      <ProtectedRoute adminOnly>
                        <AdminDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/manager" element={
                      <ProtectedRoute managerOnly>
                        <ManagerDashboard />
                      </ProtectedRoute>
                    } />
                  </Routes>
                </main>
              </div>
            </CartProvider>
          </NotificationsProvider>
        </WishlistProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
