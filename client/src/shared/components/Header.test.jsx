import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Header from './Header';

var authState = { user: null, logout: vi.fn() };
var cartState = { cartCount: 0 };
var wishlistState = { wishlistCount: 0 };
var notificationsState = { unreadCount: 0 };
var themeState = { theme: 'light', toggleTheme: vi.fn() };

vi.mock('../../features/auth/hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../../features/cart/context/CartContext', () => ({
  useCart: () => cartState,
}));

vi.mock('../../features/wishlist/context/WishlistContext', () => ({
  useWishlist: () => wishlistState,
}));

vi.mock('../../features/notifications/context/NotificationsContext', () => ({
  useNotifications: () => notificationsState,
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => themeState,
}));

describe('Header mobile navigation', () => {
  beforeEach(() => {
    authState = { user: null, logout: vi.fn() };
    cartState = { cartCount: 2 };
    wishlistState = { wishlistCount: 3 };
    notificationsState = { unreadCount: 1 };
    themeState = { theme: 'light', toggleTheme: vi.fn() };
  });

  it('shows login action in the mobile menu for guests', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Відкрити меню' }));

    expect(screen.getAllByText('Увійти').length).toBeGreaterThan(0);
    expect(screen.getByText('Створити акаунт')).toBeTruthy();
    expect(screen.getAllByText('Каталог').length).toBeGreaterThan(0);
  });

  it('shows profile and backoffice links in the mobile menu for authenticated staff', () => {
    authState = {
      user: {
        email: 'manager@example.com',
        first_name: 'Ірина',
        role: 'manager',
      },
      logout: vi.fn(),
    };

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Відкрити меню' }));

    expect(screen.getAllByText('Профіль').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Операційна панель').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Адмін-панель').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Вийти/i }).length).toBeGreaterThan(0);
  });
});
