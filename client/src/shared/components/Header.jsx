import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Heart, LogOut, Menu, Moon, Search, ShoppingCart, SunMedium, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useCart } from '../../features/cart/context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { useWishlist } from '../../features/wishlist/context/WishlistContext';
import { useNotifications } from '../../features/notifications/context/NotificationsContext';
import { getBackofficeLinks, getRoleLabel } from '../utils/roles';

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
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const backofficeLinks = getBackofficeLinks(user?.role);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logout();
    navigate('/');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setMobileMenuOpen(false);
      navigate(`/catalog?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const iconButtonClass = 'relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/50 bg-white/70 text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-amber-200 hover:text-amber-700 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-amber-500/40 dark:hover:text-amber-300';
  const mobileLinkClass = 'flex items-center justify-between rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-amber-200 hover:text-amber-700 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-amber-500/40 dark:hover:text-amber-300';

  return (
    <header className="sticky top-0 z-40 border-b border-white/40 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
      <div className="flex w-full items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="shrink-0">
          <div className="rounded-3xl bg-slate-950 px-3 py-2 text-base font-black tracking-[0.18em] text-amber-300 shadow-lg shadow-slate-950/20 sm:px-4 sm:text-lg dark:bg-amber-400 dark:text-slate-950">
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
          <Link to="/catalog" className="text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">Каталог</Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={toggleTheme} className={`${iconButtonClass} hidden sm:inline-flex`} title="Змінити тему" type="button">
            {theme === 'dark' ? <SunMedium className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <Link to="/wishlist" className={`${iconButtonClass} hidden sm:inline-flex`} title="Обране">
            <Heart className="h-5 w-5" fill={wishlistCount ? 'currentColor' : 'none'} />
            <Badge count={wishlistCount} />
          </Link>

          <Link to="/notifications" className={`${iconButtonClass} hidden sm:inline-flex`} title="Сповіщення">
            <Bell className={`h-5 w-5 ${unreadCount ? 'animate-[swing_1.8s_ease-in-out_infinite]' : ''}`} />
            <Badge count={unreadCount} tone="danger" />
          </Link>

          <Link to="/cart" className={iconButtonClass} title="Кошик">
            <ShoppingCart className="h-5 w-5" />
            <Badge count={cartCount} />
          </Link>

          {user ? (
            <div className="hidden items-center gap-3 rounded-2xl border border-white/50 bg-white/70 px-4 py-2 shadow-sm backdrop-blur md:flex dark:border-white/10 dark:bg-slate-900/60">
              <div className="flex flex-col">
                <Link to="/profile" className="text-sm font-medium text-slate-700 transition hover:text-amber-700 dark:text-slate-200 dark:hover:text-amber-300">
                  {user.first_name || user.email}
                </Link>
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  {getRoleLabel(user.role)}
                </span>
              </div>
              {backofficeLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  {link.label}
                </Link>
              ))}
              <button onClick={handleLogout} className="text-slate-500 transition hover:text-rose-500" title="Вийти" type="button">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link to="/login" className="hidden rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 md:inline-flex dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300">
              Увійти
            </Link>
          )}

          <button
            type="button"
            className={`${iconButtonClass} sm:hidden`}
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-header-menu"
            aria-label={mobileMenuOpen ? 'Закрити меню' : 'Відкрити меню'}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="border-t border-white/40 px-4 pb-3 pt-0 md:hidden dark:border-white/10">
        <form onSubmit={handleSearch} className="mt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Пошук товарів"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/60 bg-white/80 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-300 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </form>
      </div>

      {mobileMenuOpen ? (
        <div id="mobile-header-menu" className="border-t border-white/40 px-4 pb-4 pt-3 sm:hidden dark:border-white/10">
          <div className="space-y-3">
            {user ? (
              <div className="rounded-[1.75rem] border border-white/50 bg-white/80 px-4 py-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-amber-400 dark:text-slate-950">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <Link to="/profile" className="block truncate text-sm font-semibold text-slate-800 dark:text-white">
                      {user.first_name || user.email}
                    </Link>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                      {getRoleLabel(user.role)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  <Link to="/profile" className={mobileLinkClass}>Профіль</Link>
                  {backofficeLinks.map((link) => (
                    <Link key={link.path} to={link.path} className={mobileLinkClass}>
                      {link.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"
                  >
                    Вийти
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <Link to="/login" className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300">
                  Увійти
                </Link>
                <Link to="/register" className={mobileLinkClass}>
                  Створити акаунт
                </Link>
              </div>
            )}

            <div className="grid gap-2">
              <Link to="/catalog" className={mobileLinkClass}>Каталог</Link>
              <Link to="/wishlist" className={mobileLinkClass}>
                <span>Обране</span>
                {wishlistCount ? <span className="text-xs font-bold text-amber-600 dark:text-amber-300">{wishlistCount}</span> : null}
              </Link>
              <Link to="/notifications" className={mobileLinkClass}>
                <span>Сповіщення</span>
                {unreadCount ? <span className="text-xs font-bold text-rose-500">{unreadCount}</span> : null}
              </Link>
              <button type="button" onClick={toggleTheme} className={mobileLinkClass}>
                <span>{theme === 'dark' ? 'Світла тема' : 'Темна тема'}</span>
                {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
