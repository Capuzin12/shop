import { Link, useNavigate } from 'react-router-dom';
import { Bell, Heart, LogOut, Moon, Search, ShoppingCart, SunMedium } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useTheme } from '../contexts/ThemeContext';
import { useWishlist } from '../contexts/WishlistContext';
import { useNotifications } from '../contexts/NotificationsContext';

const Badge = ({ count, tone = 'accent' }) => {
  if (!count) return null;

  const toneClass = tone === 'danger'
    ? 'bg-rose-500 text-white shadow-rose-500/30'
    : 'bg-amber-500 text-slate-950 shadow-amber-500/30';

  return (
    <span className={`absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold shadow-lg ${toneClass}`}>
      {count > 99 ? '99+' : count}
    </span>
  );
};

export default function Header() {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { unreadCount } = useNotifications();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/catalog?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const iconButtonClass = 'relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/50 bg-white/70 text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-amber-200 hover:text-amber-700 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-amber-500/40 dark:hover:text-amber-300';

  return (
    <header className="sticky top-0 z-40 border-b border-white/40 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="shrink-0">
          <div className="rounded-3xl bg-slate-950 px-4 py-2 text-lg font-black tracking-[0.2em] text-amber-300 shadow-lg shadow-slate-950/20 dark:bg-amber-400 dark:text-slate-950">
            BUILDSHOP
          </div>
        </Link>

        <form onSubmit={handleSearch} className="hidden flex-1 md:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Пошук матеріалів, брендів, товарів"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/60 bg-white/80 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none ring-0 transition placeholder:text-slate-400 focus:border-amber-300 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </form>

        <nav className="hidden items-center gap-5 lg:flex">
          <Link to="/" className="text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">Головна</Link>
          <Link to="/catalog" className="text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">Каталог</Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={toggleTheme} className={iconButtonClass} title="Змінити тему" type="button">
            {theme === 'dark' ? <SunMedium className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <Link to="/wishlist" className={iconButtonClass} title="Вподобайки">
            <Heart className="h-5 w-5" fill={wishlistCount ? 'currentColor' : 'none'} />
            <Badge count={wishlistCount} />
          </Link>

          <Link to="/notifications" className={iconButtonClass} title="Сповіщення">
            <Bell className={`h-5 w-5 ${unreadCount ? 'animate-[swing_1.8s_ease-in-out_infinite]' : ''}`} />
            <Badge count={unreadCount} tone="danger" />
          </Link>

          <Link to="/cart" className={iconButtonClass} title="Кошик">
            <ShoppingCart className="h-5 w-5" />
            <Badge count={cartCount} />
          </Link>

          {user ? (
            <div className="hidden items-center gap-3 rounded-2xl border border-white/50 bg-white/70 px-4 py-2 shadow-sm backdrop-blur md:flex dark:border-white/10 dark:bg-slate-900/60">
              <Link to="/profile" className="text-sm font-medium text-slate-700 transition hover:text-amber-700 dark:text-slate-200 dark:hover:text-amber-300">
                {user.first_name || user.email}
              </Link>
              <button onClick={handleLogout} className="text-slate-500 transition hover:text-rose-500" type="button">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link to="/login" className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300">
              Увійти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
