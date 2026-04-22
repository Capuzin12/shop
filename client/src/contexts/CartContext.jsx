/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

const STORAGE_KEY = 'buildshop-cart';
const MAX_ALLOWED_QUANTITY = 999;

const readLocalCart = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const clampQuantity = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.min(parsed, MAX_ALLOWED_QUANTITY);
};

const sanitizeCartItems = (items) => {
  if (!Array.isArray(items)) return [];
  const merged = new Map();
  items.forEach((item) => {
    const productId = Number.parseInt(item?.id, 10);
    if (!Number.isFinite(productId) || productId <= 0) return;
    const safeQuantity = clampQuantity(item?.quantity);
    const existing = merged.get(productId);
    if (existing) {
      merged.set(productId, { ...existing, quantity: Math.min(existing.quantity + safeQuantity, MAX_ALLOWED_QUANTITY) });
      return;
    }
    merged.set(productId, { ...item, id: productId, quantity: safeQuantity });
  });
  return Array.from(merged.values());
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

const toQuantityMap = (items) => items.reduce((acc, item) => {
  if (!item?.id || !item?.quantity) return acc;
  acc.set(item.id, (acc.get(item.id) || 0) + item.quantity);
  return acc;
}, new Map());

const quantityMapsEqual = (left, right) => {
  if (left.size !== right.size) return false;
  for (const [key, value] of left.entries()) {
    if (right.get(key) !== value) return false;
  }
  return true;
};

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState(() => sanitizeCartItems(readLocalCart()));
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
      setServerCartSnapshot(null);
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
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart, user]);

  useEffect(() => {
    const syncCart = async () => {
      if (syncedRef.current || !user) {
        return;
      }
      syncedRef.current = true;

      const guestCart = sanitizeCartItems(readLocalCart());
      const serverSnapshot = await refreshServerCart();

      if (guestCart.length) {
        const serverNormalized = normalizeServerCart(serverSnapshot);
        const guestMap = toQuantityMap(guestCart);
        const serverMap = toQuantityMap(serverNormalized);
        const hasRealGuestDelta = !quantityMapsEqual(guestMap, serverMap);
        if (!hasRealGuestDelta) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
          return;
        }

        const serverQuantities = new Map((serverSnapshot?.items || []).map((item) => [item.product_id, item.quantity]));
        const mergedGuest = guestCart.reduce((acc, item) => {
          const current = acc.get(item.id) || 0;
          acc.set(item.id, Math.min(current + clampQuantity(item.quantity), MAX_ALLOWED_QUANTITY));
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

  useEffect(() => {
    if (!user) {
      syncedRef.current = false;
      serverItemMapRef.current = new Map();
      serverCartRef.current = null;
      syncTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      syncTimersRef.current.clear();
      syncingRef.current.clear();
    }
  }, [user]);

  const addToCart = async (product, quantity = 1) => {
    const safeQuantity = clampQuantity(quantity);
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      const stock_quantity = product.quantity ?? product.stock_quantity ?? 0;
      if (existing) {
        const nextQuantity = Math.min(existing.quantity + safeQuantity, MAX_ALLOWED_QUANTITY);
        if (user) {
          queueServerSync({ ...product, id: product.id }, nextQuantity);
        }
        return prev.map((item) => (
          item.id === product.id ? { ...item, quantity: nextQuantity } : item
        ));
      }
      if (user) {
        queueServerSync({ ...product, id: product.id }, safeQuantity);
      }
      return [...prev, {
        ...product,
        quantity: safeQuantity,
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
    const safeQuantity = Number.parseInt(quantity, 10);
    if (!Number.isFinite(safeQuantity) || safeQuantity <= 0) {
      await removeFromCart(productId);
      return;
    }

    const currentItem = cart.find((item) => item.id === productId);
    if (!currentItem) return;
    const normalizedQuantity = Math.min(safeQuantity, MAX_ALLOWED_QUANTITY);
    updateLocalCartQuantity(currentItem, normalizedQuantity);
    if (user) {
      queueServerSync(currentItem, normalizedQuantity);
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
