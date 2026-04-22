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

const normalizeProductForCart = (product) => {
  const stockQuantity = product?.quantity ?? product?.stock_quantity ?? 0;
  return {
    id: product.id,
    name: product.name || 'Товар',
    price: product.price || 0,
    quantity: 1,
    slug: product.slug || '',
    sku: product.sku || '',
    description: product.description || '',
    old_price: product.old_price || null,
    stock_quantity: stockQuantity,
    in_stock: product.in_stock ?? stockQuantity > 0,
  };
};

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState(() => readLocalCart());
  const [serverCart, setServerCart] = useState(null);
  const syncedRef = useRef(false);
  const syncTimersRef = useRef(new Map());
  const syncingRef = useRef(new Set());
  const serverItemMapRef = useRef(new Map());
  const serverCartRef = useRef(null);

  const setServerCartSnapshot = (serverData) => {
    serverCartRef.current = serverData || null;
    const map = new Map();
    (serverData?.items || []).forEach((item) => {
      if (item?.product_id && item?.id) {
        map.set(item.product_id, item.id);
      }
    });
    serverItemMapRef.current = map;
    setServerCart(serverData || null);
  };

  const updateLocalCartQuantity = (productLike, quantity) => {
    const productId = productLike?.id;
    if (!productId) return;
    setCart((prev) => {
      if (quantity <= 0) {
        return prev.filter((item) => item.id !== productId);
      }
      const existing = prev.find((item) => item.id === productId);
      if (existing) {
        return prev.map((item) => (item.id === productId ? { ...item, quantity } : item));
      }
      return [...prev, { ...normalizeProductForCart(productLike), quantity }];
    });
  };

  const syncServerQuantity = async (productLike, desiredQuantity) => {
    const productId = productLike?.id;
    if (!user || !productId || syncingRef.current.has(productId)) {
      return;
    }
    syncingRef.current.add(productId);
    try {
      if (!serverCartRef.current) {
        const snapshot = await refreshServerCart();
        if (!snapshot) {
          return;
        }
      }

      const itemId = serverItemMapRef.current.get(productId);
      if (desiredQuantity <= 0) {
        if (itemId) {
          await api.delete(`/api/cart/items/${itemId}`);
          const nextServer = {
            ...(serverCartRef.current || {}),
            items: (serverCartRef.current?.items || []).filter((item) => item.product_id !== productId),
          };
          setServerCartSnapshot(nextServer);
        }
        return;
      }

      if (itemId) {
        await api.put(`/api/cart/items/${itemId}`, { quantity: desiredQuantity });
        const nextServer = {
          ...(serverCartRef.current || {}),
          items: (serverCartRef.current?.items || []).map((item) => (
            item.product_id === productId ? { ...item, quantity: desiredQuantity } : item
          )),
        };
        setServerCartSnapshot(nextServer);
      } else {
        const createResponse = await api.post('/api/cart/items', {
          product_id: productId,
          quantity: desiredQuantity,
        });
        const createdId = createResponse?.data?.id;
        const normalizedProduct = normalizeProductForCart(productLike);
        const nextItem = {
          id: createdId || `tmp-${productId}`,
          product_id: productId,
          quantity: desiredQuantity,
          product: {
            id: productId,
            name: normalizedProduct.name,
            price: normalizedProduct.price,
            slug: normalizedProduct.slug,
            sku: normalizedProduct.sku,
            description: normalizedProduct.description,
            old_price: normalizedProduct.old_price,
            quantity: normalizedProduct.stock_quantity,
            in_stock: normalizedProduct.in_stock,
          },
        };
        const nextServer = {
          ...(serverCartRef.current || {}),
          items: [...(serverCartRef.current?.items || []), nextItem],
        };
        setServerCartSnapshot(nextServer);
      }
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error('Error syncing cart item:', error);
      }
      await refreshServerCart();
    } finally {
      syncingRef.current.delete(productId);
    }
  };

  const queueServerSync = (productLike, quantity) => {
    const productId = productLike?.id;
    if (!productId || !user) return;
    const currentTimer = syncTimersRef.current.get(productId);
    if (currentTimer) {
      window.clearTimeout(currentTimer);
    }
    const timerId = window.setTimeout(() => {
      syncTimersRef.current.delete(productId);
      syncServerQuantity(productLike, quantity);
    }, 300);
    syncTimersRef.current.set(productId, timerId);
  };

  const refreshServerCart = async () => {
    if (!user) {
      setServerCart(null);
      return null;
    }

    try {
      const response = await api.get('/api/cart');
      setServerCartSnapshot(response.data);
      const normalized = normalizeServerCart(response.data);
      setCart(normalized);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        setServerCartSnapshot(null);
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

      const guestCart = readLocalCart();
      const serverSnapshot = await refreshServerCart();

      if (guestCart.length) {
        const serverQuantities = new Map((serverSnapshot?.items || []).map((item) => [item.product_id, item.quantity]));
        const mergedGuest = guestCart.reduce((acc, item) => {
          const current = acc.get(item.id) || 0;
          acc.set(item.id, current + item.quantity);
          return acc;
        }, new Map());

        await Promise.allSettled(Array.from(mergedGuest.entries()).map(async ([productId, guestQuantity]) => {
          const currentQuantity = serverQuantities.get(productId);
          if (currentQuantity) {
            const itemId = serverItemMapRef.current.get(productId);
            if (itemId) {
              await api.put(`/api/cart/items/${itemId}`, { quantity: currentQuantity + guestQuantity });
            }
            return;
          }
          await api.post('/api/cart/items', { product_id: productId, quantity: guestQuantity });
        }));
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      await refreshServerCart();
    };

    syncCart();
    // Keep dependency size fixed to prevent React Fast Refresh warning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const addToCart = async (product, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      const stock_quantity = product.quantity ?? product.stock_quantity ?? 0;
      if (existing) {
        if (user) {
          queueServerSync({ ...product, id: product.id }, existing.quantity + quantity);
        }
        return prev.map((item) => (
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        ));
      }
      if (user) {
        queueServerSync({ ...product, id: product.id }, quantity);
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
    const previousItem = cart.find((item) => item.id === productId);
    setCart((prev) => prev.filter((item) => item.id !== productId));
    if (user && previousItem) {
      queueServerSync(previousItem, 0);
    }
  };

  const updateQuantity = async (productId, quantity) => {
    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }

    const currentItem = cart.find((item) => item.id === productId);
    if (!currentItem) return;
    updateLocalCartQuantity(currentItem, quantity);
    if (user) {
      queueServerSync(currentItem, quantity);
    }
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
