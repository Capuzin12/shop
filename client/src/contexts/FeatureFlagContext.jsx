/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';
import { defaultFeatureFlags } from '../config/featureFlags';

const FeatureFlagContext = createContext(null);

export function FeatureFlagProvider({ children }) {
  const [flags, setFlags] = useState(defaultFeatureFlags);
  const [loading, setLoading] = useState(true);

  const refreshFlags = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/feature-flags');
      const serverFlags = response.data?.flags || {};
      setFlags((prev) => ({ ...prev, ...serverFlags }));
    } catch {
      setFlags(defaultFeatureFlags);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFlags();
  }, [refreshFlags]);

  useEffect(() => {
    Object.entries(flags).forEach(([key, value]) => {
      localStorage.setItem(`feature:${key}`, String(Boolean(value)));
    });
  }, [flags]);

  const isEnabled = useCallback((flagName) => Boolean(flags[flagName]), [flags]);

  const value = useMemo(() => ({
    flags,
    loading,
    isEnabled,
    refreshFlags,
  }), [flags, loading, isEnabled, refreshFlags]);

  return <FeatureFlagContext.Provider value={value}>{children}</FeatureFlagContext.Provider>;
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagProvider');
  }
  return context;
}


