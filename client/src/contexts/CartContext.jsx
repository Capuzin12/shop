/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

const STORAGE_KEY = 'buildshop-cart';

const readLocalCart = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const normalizeServerCart = (serverCart) => {
  const serverItems = serverCart?.items || [];
  return serverItems.map((item) => ({
    id: item.product_id,
    name: item.product?.name || 'Товар',
    price: item.product?.price || 0,
    quantity: item.quantity,
    slug: item.product?.slug || '',
    sku: item.product?.sku || '',
    description: item.product?.description || '',
    old_price: item.product?.old_price || null,
    stock_quantity: item.product?.quantity ?? item.product?.stock_quantity ?? 0,
    in_stock: item.product?.in_stock ?? (item.product?.quantity ?? 0) > 0,
  }));
};

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState(() => readLocalCart());
  const [serverCart, setServerCart] = useState(null);
  const syncedRef = useRef(false);

  const refreshServerCart = async (tokenOverride) => {
    const token = tokenOverride || localStorage.getItem('token');
    if (!token || !user) {
      setServerCart(null);
      return null;
    }

    try {
      const response = await api.get('/api/cart');
      setServerCart(response.data);
      const normalized = normalizeServerCart(response.data);
      setCart(normalized);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        setServerCart(null);
        return null;
      }
      console.error('Error syncing cart:', error);
      return null;
    }
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const syncCart = async () => {
      if (syncedRef.current || !user) {
        return;
      }
      syncedRef.current = true;

      const token = localStorage.getItem('token');
      if (!token) {
        return;
      }

      const guestCart = readLocalCart();
      const serverSnapshot = await refreshServerCart(token);

      if (guestCart.length) {
        const existingIds = new Set((serverSnapshot?.items || []).map((item) => item.product_id));
        for (const item of guestCart) {
          try {
            if (!existingIds.has(item.id)) {
              await api.post('/api/cart/items', {
                product_id: item.id,
                quantity: item.quantity,
              });
            }
          } catch (error) {
            console.error('Error syncing cart item:', error);
          }
        }
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      await refreshServerCart(token);
    };

    syncCart();
    // Keep dependency size fixed to prevent React Fast Refresh warning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const addToCart = async (product, quantity = 1) => {
    const token = localStorage.getItem('token');

    if (user && token) {
      try {
        const currentCart = serverCart || await refreshServerCart(token);
        const existingItem = currentCart?.items?.find((item) => item.product_id === product.id);
        
        if (existingItem) {
          await api.put(`/api/cart/items/${existingItem.id}`, { 
            quantity: existingItem.quantity + quantity 
          });
        } else {
          await api.post('/api/cart/items', {
            product_id: product.id,
            quantity,
          });
        }
        await refreshServerCart(token);
        return;
      } catch (error) {
        if (error.response?.status === 401) {
          console.log('Token expired, adding to local cart instead');
        } else {
          console.error('Error adding to server cart:', error);
        }
      }
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      const stock_quantity = product.quantity ?? product.stock_quantity ?? 0;
      if (existing) {
        return prev.map((item) => (
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        ));
      }
      return [...prev, {
        ...product,
        quantity,
        stock_quantity,
        in_stock: product.in_stock ?? stock_quantity > 0,
      }];
    });
  };

  const removeFromCart = async (productId) => {
    const token = localStorage.getItem('token');
    if (user && token) {
      const cartSnapshot = serverCart || await refreshServerCart(token);
      const item = cartSnapshot?.items?.find((entry) => entry.product_id === productId);
      if (item) {
        try {
          await api.delete(`/api/cart/items/${item.id}`);
          await refreshServerCart(token);
          return;
        } catch (error) {
          if (error.response?.status !== 401) {
            console.error('Error removing from server cart:', error);
          }
        }
      }
    }

    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const updateQuantity = async (productId, quantity) => {
    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }

    const token = localStorage.getItem('token');
    if (user && token) {
      const cartSnapshot = serverCart || await refreshServerCart(token);
      const item = cartSnapshot?.items?.find((entry) => entry.product_id === productId);
      if (item) {
        try {
          await api.put(`/api/cart/items/${item.id}`, { quantity });
          await refreshServerCart(token);
          return;
        } catch (error) {
          if (error.response?.status !== 401) {
            console.error('Error updating server cart:', error);
          }
        }
      }
    }

    setCart((prev) => prev.map((item) => (
      item.id === productId ? { ...item, quantity } : item
    )));
  };

  const clearCart = () => {
    setCart([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  };

  const getTotal = () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const value = {
    cart,
    cartCount: cart.reduce((total, item) => total + item.quantity, 0),
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotal,
    refreshServerCart,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
