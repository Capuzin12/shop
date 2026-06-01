import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../api';

export function useInventoryMovements(inventoryId, enabled = false) {
  return useQuery({
    queryKey: ['inventory-movements', inventoryId],
    queryFn: async () => {
      const { data } = await api.get(`/api/inventory/${inventoryId}/movements`, { params: { limit: 20 } });
      return data;
    },
    enabled: Boolean(inventoryId) && enabled,
    staleTime: 0,
  });
}

export function useRecentMovements() {
  return useQuery({
    queryKey: ['inventory-movements-recent'],
    queryFn: async () => {
      const { data } = await api.get('/api/inventory/movements/recent', { params: { limit: 50 } });
      return data;
    },
    staleTime: 1000 * 60,
  });
}

export function useAdjustInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ inventoryId, delta, movementType, note }) => {
      const { data } = await api.post(`/api/inventory/${inventoryId}/adjust`, { delta, movement_type: movementType, note });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements-recent'] });
    },
  });
}

