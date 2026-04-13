/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);

const GUEST_WISHLIST_KEY = 'guest_wishlist_items';

const readGuestWishlist = () => {
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeGuestWishlist = (items) => {
  localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(items));
};

const normalizeGuestItem = (product) => ({
  product_id: product.id,
  product: {
    id: product.id,
    name: product.name,
    price: product.price,
    old_price: product.old_price ?? null,
    sku: product.sku ?? '',
    slug: product.slug ?? '',
    badge: product.badge ?? null,
  },
  added_at: new Date().toISOString(),
});

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshWishlist = async (tokenOverride) => {
    const token = tokenOverride || user?.token || localStorage.getItem('token');

    if (!token || !user) {
      const guestItems = readGuestWishlist();
      setItems(guestItems);
      setLoading(false);
      return guestItems;
    }

    setLoading(true);
    try {
      const response = await api.get('/api/wishlist');
      const nextItems = Array.isArray(response.data) ? response.data : [];
      setItems(nextItems);
      return nextItems;
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      setItems([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const syncWishlist = async () => {
      const token = user?.token || localStorage.getItem('token');

      if (!user || !token) {
        setItems(readGuestWishlist());
        setLoading(false);
        return;
      }

      const guestItems = readGuestWishlist();
      if (guestItems.length) {
        for (const item of guestItems) {
          try {
            await api.post('/api/wishlist', { product_id: item.product_id });
          } catch (error) {
            if (error?.response?.status !== 400) {
              console.error('Error syncing wishlist item:', error);
            }
          }
        }
        writeGuestWishlist([]);
      }

      await refreshWishlist(token);
    };

    syncWishlist();
  }, [user]);

  const toggleWishlist = async (product, options = {}) => {
    const productId = typeof product === 'number' ? product : product?.id;
    if (!productId) {
      return false;
    }

    const existing = items.some((item) => item.product_id === productId);
    const token = user?.token || localStorage.getItem('token');

    if (!user || !token) {
      const guestItems = readGuestWishlist();
      const nextItems = existing
        ? guestItems.filter((item) => item.product_id !== productId)
        : [...guestItems, normalizeGuestItem(product)];
      writeGuestWishlist(nextItems);
      setItems(nextItems);
      return !existing;
    }

    try {
      if (existing) {
        await api.delete(`/api/wishlist/${productId}`);
        const nextItems = items.filter((item) => item.product_id !== productId);
        setItems(nextItems);
        return false;
      }

      await api.post('/api/wishlist', { product_id: productId });

      if (options.refresh !== false) {
        await refreshWishlist(token);
      }
      return true;
    } catch (error) {
      console.error('Error toggling wishlist:', error);
      return existing;
    }
  };

  const removeFromWishlist = async (productId) => {
    const token = user?.token || localStorage.getItem('token');
    if (!user || !token) {
      const nextItems = readGuestWishlist().filter((item) => item.product_id !== productId);
      writeGuestWishlist(nextItems);
      setItems(nextItems);
      return;
    }

    try {
      await api.delete(`/api/wishlist/${productId}`);
      setItems((prev) => prev.filter((item) => item.product_id !== productId));
    } catch (error) {
      console.error('Error removing wishlist item:', error);
    }
  };

  const value = {
    items,
    wishlistCount: items.length,
    loading,
    wishlistIds: items.map((item) => item.product_id),
    isWishlisted: (productId) => items.some((item) => item.product_id === productId),
    toggleWishlist,
    removeFromWishlist,
    refreshWishlist,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return context;
}
