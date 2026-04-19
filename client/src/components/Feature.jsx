import { useFeatureFlags } from '../contexts/FeatureFlagContext';

export default function Feature({ flag, fallback = null, children }) {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(flag) ? children : fallback;
}

