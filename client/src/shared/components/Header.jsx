import { Link, useNavigate } from 'react-router-dom';
import { Bell, Heart, LogOut, Menu, Moon, Search, ShoppingCart, SunMedium, User, X } from 'lucide-react';
import { useState, useRef, useEffect} from 'react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useCart } from '../../features/cart/context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { useWishlist } from '../../features/wishlist/context/WishlistContext';
import { useNotifications } from '../../features/notifications/context/NotificationsContext';
import { getBackofficeLinks, getRoleLabel } from '../utils/roles';
import api from '../../api';

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

function SearchDropdown({ query, onSelect}) {
  const [suggestions, setSuggestions] = useState({ products: [], categories: [], brands: [] });
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const q = (query || '').trim();
    if (q.length < 1) {
      setSuggestions({ products: [], categories: [], brands: [] });
      return;
    }

    clearTimeout(timerRef.current);
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/search/suggestions', { params: { q } });
        setSuggestions(data || { products: [], categories: [], brands: [] });
      } catch {
        setSuggestions({ products: [], categories: [], brands: [] });
      } finally {
        setLoading(false);
      }
    }, 600);

    return () => clearTimeout(timerRef.current);
  }, [query]);

  const hasResults = suggestions.products.length > 0 || suggestions.categories.length > 0 || suggestions.brands.length > 0;

  if ((query || '').trim().length < 1) return null;

  return (
      <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-white/60 bg-white/95 shadow-2xl shadow-slate-950/20 backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
        {loading && !hasResults ? (
            <div className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">
              Пошук…
            </div>
        ) : !hasResults ? (
            <div className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">
              Нічого не знайдено для «{query}»
            </div>
        ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-white/10">
              {suggestions.products.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                      Товари
                    </p>
                    {suggestions.products.slice(0, 5).map((item) => (
                        <button
                            key={`p-${item.id}`}
                            type="button"
                            onClick={() => onSelect('product', item)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-amber-50 dark:hover:bg-amber-500/10"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 overflow-hidden dark:bg-white/10">
                              {item.image_url
                                  ? <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                                  : <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{item.sku ? item.sku.slice(0, 2).toUpperCase() : '##'}</span>
                              }
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{item.name}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              {item.sku}
                              {typeof item.quantity === 'number'
                                  ? ` · ${item.quantity > 0 ? `${item.quantity} на складі` : 'немає на складі'}`
                                  : ''}
                            </p>
                          </div>
                          {item.price ? (
                              <span className="shrink-0 text-sm font-semibold text-amber-600 dark:text-amber-300">
                      {new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', maximumFractionDigits: 0 }).format(item.price)}
                    </span>
                          ) : null}
                        </button>
                    ))}
                  </div>
              )}

              {suggestions.categories.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                      Категорії
                    </p>
                    <div className="flex flex-wrap gap-2 px-4 pb-3">
                      {suggestions.categories.slice(0, 5).map((item) => (
                          <button
                              key={`c-${item.id}`}
                              type="button"
                              onClick={() => onSelect('category', item)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-amber-400/30 dark:hover:bg-amber-400/10 dark:hover:text-amber-200"
                          >
                            {item.name}
                          </button>
                      ))}
                    </div>
                  </div>
              )}

              {suggestions.brands.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                      Бренди
                    </p>
                    <div className="flex flex-wrap gap-2 px-4 pb-3">
                      {suggestions.brands.slice(0, 5).map((item) => (
                          <button
                              key={`b-${item.id}`}
                              type="button"
                              onClick={() => onSelect('brand', item)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-amber-400/30 dark:hover:bg-amber-400/10 dark:hover:text-amber-200"
                          >
                            {item.name}
                          </button>
                      ))}
                    </div>
                  </div>
              )}

              <div className="px-4 py-2.5">
                <button
                    type="button"
                    onClick={() => onSelect('search', { name: query })}
                    className="flex w-full items-center gap-2 text-sm text-slate-500 transition hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-300"
                >
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  Шукати «{query}» в каталозі
                </button>
              </div>
            </div>
        )}
      </div>
  );
}

function SearchBar({ className = '', inputClass = '', placeholder = 'Пошук матеріалів, брендів, товарів' }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (type, item) => {
    setOpen(false);
    if (type === 'product') {
      navigate(`/product/${item.id}`);
      setQuery('');
    } else if (type === 'category') {
      navigate(`/catalog?category_id=${item.id}`);
      setQuery('');
    } else if (type === 'brand') {
      navigate(`/catalog?search=${encodeURIComponent(item.name)}`);
      setQuery('');
    } else {
      navigate(`/catalog?search=${encodeURIComponent(item.name)}`);
      setQuery('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      setOpen(false);
      navigate(`/catalog?search=${encodeURIComponent(q)}`);
      setQuery('');
    }
  };

  return (
      <div ref={wrapperRef} className={`relative ${className}`}>
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
                type="text"
                placeholder={placeholder}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                className={`w-full rounded-2xl border border-white/60 bg-white/80 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none ring-0 transition placeholder:text-slate-400 focus:border-amber-300 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500 ${inputClass}`}
            />
            {query ? (
                <button
                    type="button"
                    onClick={() => { setQuery(''); setOpen(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
            ) : null}
          </div>
        </form>

        {open && (
            <SearchDropdown
                query={query}
                onSelect={handleSelect}
                onClose={() => setOpen(false)}
            />
        )}
      </div>
  );
}

export { SearchBar };

export default function Header() {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { unreadCount } = useNotifications();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const backofficeLinks = getBackofficeLinks(user?.role);

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logout();
    navigate('/');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const iconButtonClass = 'relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/50 bg-white/70 text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-amber-200 hover:text-amber-700 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-amber-500/40 dark:hover:text-amber-300';
  const mobileLinkClass = 'flex items-center justify-between rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-amber-200 hover:text-amber-700 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-amber-500/40 dark:hover:text-amber-300';

  return (
      <header className="sticky top-0 z-40 border-b border-white/40 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
        <div className="flex w-full items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/catalog" className="shrink-0">
            <div className="rounded-3xl bg-slate-950 px-3 py-2 text-base font-black tracking-[0.18em] text-amber-300 shadow-lg shadow-slate-950/20 sm:px-4 sm:text-lg dark:bg-amber-400 dark:text-slate-950">
              BUILDSHOP
            </div>
          </Link>

          {/* Desktop search with live dropdown */}
          <SearchBar className="hidden flex-1 md:block" />

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

        {/* Mobile search */}
        <div className="border-t border-white/40 px-4 pb-3 pt-0 md:hidden dark:border-white/10">
          <SearchBar className="mt-3" placeholder="Пошук товарів" />
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
                          <Link to="/profile" onClick={closeMobileMenu} className="block truncate text-sm font-semibold text-slate-800 dark:text-white">
                            {user.first_name || user.email}
                          </Link>
                          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                            {getRoleLabel(user.role)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2">
                        <Link to="/profile" onClick={closeMobileMenu} className={mobileLinkClass}>Профіль</Link>
                        {backofficeLinks.map((link) => (
                            <Link key={link.path} to={link.path} onClick={closeMobileMenu} className={mobileLinkClass}>
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
                      <Link to="/login" onClick={closeMobileMenu} className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300">
                        Увійти
                      </Link>
                      <Link to="/register" onClick={closeMobileMenu} className={mobileLinkClass}>
                        Створити акаунт
                      </Link>
                    </div>
                )}

                <div className="grid gap-2">
                  <Link to="/wishlist" onClick={closeMobileMenu} className={mobileLinkClass}>
                    <span>Обране</span>
                    {wishlistCount ? <span className="text-xs font-bold text-amber-600 dark:text-amber-300">{wishlistCount}</span> : null}
                  </Link>
                  <Link to="/notifications" onClick={closeMobileMenu} className={mobileLinkClass}>
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