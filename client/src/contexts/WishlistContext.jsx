/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  const syncedRef = useRef(false);

  const refreshWishlist = async () => {
    if (!user) {
      const guestItems = readGuestWishlist();
      setItems(guestItems);
      setLoading(false);
      return guestItems;
    }

    setLoading(true);
    try {
      const response = await api.get('/api/wishlist');
      const wishlistData = response.data;
      const validItems = Array.isArray(wishlistData) 
        ? wishlistData.filter(item => item && item.product_id)
        : [];
      setItems(validItems);
      return validItems;
    } catch (error) {
      if (error.response?.status === 401) {
        const guestItems = readGuestWishlist();
        setItems(guestItems);
        setLoading(false);
        return guestItems;
      }
      console.error('Error fetching wishlist:', error);
      setItems([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const syncWishlist = async () => {
      if (syncedRef.current || !user) {
        return;
      }
      syncedRef.current = true;

      const guestItems = readGuestWishlist();
      if (guestItems.length) {
        for (const item of guestItems) {
          try {
            await api.post('/api/wishlist', { product_id: item.product_id });
          } catch (error) {
            if (error.response?.status === 401) {
              break;
            }
            if (error?.response?.status !== 400) {
              console.error('Error syncing wishlist item:', error);
            }
          }
        }
        writeGuestWishlist([]);
      }

      await refreshWishlist();
    };

    syncWishlist();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleWishlist = async (product, options = {}) => {
    const productId = typeof product === 'number' ? product : product?.id;
    if (!productId) {
      return false;
    }

    const existing = items.some((item) => item.product_id === productId);
    if (!user) {
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
        await refreshWishlist();
      }
      return true;
    } catch (error) {
      if (error.response?.status === 401) {
        const guestItems = readGuestWishlist();
        const nextItems = existing
          ? guestItems.filter((item) => item.product_id !== productId)
          : [...guestItems, normalizeGuestItem(product)];
        writeGuestWishlist(nextItems);
        setItems(nextItems);
        return !existing;
      }
      console.error('Error toggling wishlist:', error);
      return existing;
    }
  };

  const removeFromWishlist = async (productId) => {
    if (!user) {
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
