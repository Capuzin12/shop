import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export function useProductPrices(productId) {
  return useQuery({
    queryKey: ['product-prices', productId],
    queryFn: async () => {
      const { data } = await api.get(`/api/admin/products/${productId}/prices`);
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(productId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpsertProductPrice(productId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(`/api/admin/products/${productId}/prices`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-prices', productId] });
      queryClient.invalidateQueries({ queryKey: ['product-effective-price', productId] });
    },
  });
}

export function useDeleteProductPrice(productId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (priceId) => {
      await api.delete(`/api/admin/products/${productId}/prices/${priceId}`);
      return priceId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-prices', productId] });
      queryClient.invalidateQueries({ queryKey: ['product-effective-price', productId] });
    },
  });
}

export function useEffectivePrice(productId, quantity = 1) {
  return useQuery({
    queryKey: ['product-effective-price', productId, { quantity }],
    queryFn: async () => {
      const { data } = await api.get(`/api/products/${productId}/effective-price`, { params: { quantity } });
      return data;
    },
    enabled: Boolean(productId),
    staleTime: 1000 * 60 * 5,
  });
}

