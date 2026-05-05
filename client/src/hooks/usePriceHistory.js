import { useQuery } from '@tanstack/react-query';
import api from '../api';

export function useProductPriceHistory(productId, page = 1) {
  return useQuery({
    queryKey: ['price-history', productId, { page }],
    queryFn: async () => {
      const { data } = await api.get(`/api/admin/products/${productId}/price-history`, { params: { page, per_page: 20 } });
      return data;
    },
    enabled: Boolean(productId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useGlobalPriceHistory(filters = {}) {
  return useQuery({
    queryKey: ['global-price-history', filters],
    queryFn: async () => {
      const { data } = await api.get('/api/admin/price-history', { params: filters });
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

