import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api';

const CUSTOMER_GROUPS_KEY = ['customer-groups'];

export function useCustomerGroups() {
  return useQuery({
    queryKey: CUSTOMER_GROUPS_KEY,
    queryFn: async () => {
      const { data } = await api.get('/api/admin/customer-groups');
      return Array.isArray(data) ? data : [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateCustomerGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/admin/customer-groups', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMER_GROUPS_KEY });
    },
  });
}

export function useUpdateCustomerGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put(`/api/admin/customer-groups/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMER_GROUPS_KEY });
    },
  });
}

export function useDeleteCustomerGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/api/admin/customer-groups/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMER_GROUPS_KEY });
    },
  });
}

export function useAssignCustomerGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, customer_group_id }) => {
      const { data } = await api.patch(`/api/users/${userId}/customer-group`, { customer_group_id });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: CUSTOMER_GROUPS_KEY });
    },
  });
}

