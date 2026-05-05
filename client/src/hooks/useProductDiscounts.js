import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export function useProductDiscounts(productId) {
  return useQuery({
    queryKey: ['product-discounts', productId],
    queryFn: async () => {
      const { data } = await api.get(`/api/admin/products/${productId}/discounts`);
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(productId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateDiscount(productId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(`/api/admin/products/${productId}/discounts`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-discounts', productId] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateDiscount(productId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put(`/api/admin/products/${productId}/discounts/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-discounts', productId] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteDiscount(productId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/api/admin/products/${productId}/discounts/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-discounts', productId] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

