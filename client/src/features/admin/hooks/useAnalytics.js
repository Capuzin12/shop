import { useQuery } from '@tanstack/react-query';
import api from '../../../api';

const ANALYTICS_QUERY_OPTIONS = {
  staleTime: 0,
  refetchOnMount: 'always',
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchInterval: 1000 * 60,
  refetchIntervalInBackground: false,
};

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ['analytics','overview'],
    queryFn: async () => {
      const { data } = await api.get('/api/admin/analytics/overview');
      return data;
    },
    ...ANALYTICS_QUERY_OPTIONS,
  });
}

export function useRevenueChart(period = '30d') {
  return useQuery({
    queryKey: ['analytics','revenue', period],
    queryFn: async () => {
      const { data } = await api.get('/api/admin/analytics/revenue', { params: { period } });
      return data;
    },
    ...ANALYTICS_QUERY_OPTIONS,
  });
}

export function useTopProducts(limit = 10, period = '30d') {
  return useQuery({
    queryKey: ['analytics','top-products', limit, period],
    queryFn: async () => {
      const { data } = await api.get('/api/admin/analytics/top-products', { params: { limit, period } });
      return data;
    },
    ...ANALYTICS_QUERY_OPTIONS,
  });
}

export function useInventoryHealth() {
  return useQuery({
    queryKey: ['analytics','inventory-health'],
    queryFn: async () => {
      const { data } = await api.get('/api/admin/analytics/inventory-health');
      return data;
    },
    ...ANALYTICS_QUERY_OPTIONS,
  });
}

export function useCustomerAnalytics(period = '30d') {
  return useQuery({
    queryKey: ['analytics','customers', period],
    queryFn: async () => {
      const { data } = await api.get('/api/admin/analytics/customers', { params: { period } });
      return data;
    },
    ...ANALYTICS_QUERY_OPTIONS,
  });
}

export function useInventoryMovementsAnalytics(period = '30d', limit = 20) {
  return useQuery({
    queryKey: ['analytics', 'inventory-movements', period, limit],
    queryFn: async () => {
      const { data } = await api.get('/api/admin/analytics/inventory-movements', { params: { period, limit } });
      return data;
    },
    ...ANALYTICS_QUERY_OPTIONS,
  });
}


