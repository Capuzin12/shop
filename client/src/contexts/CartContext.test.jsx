import { render, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CartProvider, useCart } from './CartContext';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../api', () => ({
  default: mockApi,
}));

vi.mock('./AuthContext', () => ({
  useAuth: () => ({ user: { id: 10 } }),
}));

describe('CartProvider sync safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not re-merge server cart on reload', async () => {
    const serverCart = {
      items: [
        {
          id: 101,
          product_id: 1,
          quantity: 3,
          product: { id: 1, name: 'Цегла', price: 50, quantity: 999, in_stock: true },
        },
      ],
    };

    localStorage.setItem('buildshop-cart', JSON.stringify([{ id: 1, quantity: 3, name: 'Цегла', price: 50 }]));
    mockApi.get.mockResolvedValue({ data: serverCart });

    render(
      <CartProvider>
        <div>test</div>
      </CartProvider>
    );

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/api/cart');
    });

    expect(mockApi.post).not.toHaveBeenCalled();
    expect(mockApi.put).not.toHaveBeenCalled();
    expect(localStorage.getItem('buildshop-cart')).toBe(JSON.stringify([]));
  });

  it('clamps oversized quantities before server sync', async () => {
    mockApi.get.mockResolvedValue({ data: { items: [] } });
    mockApi.post.mockResolvedValue({ data: { id: 501 } });

    function Probe() {
      const { addToCart } = useCart();
      const firedRef = useRef(false);
      useEffect(() => {
        if (firedRef.current) return;
        firedRef.current = true;
        addToCart({ id: 5, name: 'Шпаклівка', price: 100, quantity: 9999 }, 5000);
      }, [addToCart]);
      return null;
    }

    render(
      <CartProvider>
        <Probe />
      </CartProvider>
    );

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/api/cart/items', {
        product_id: 5,
        quantity: 999,
      });
    });
  });
});
