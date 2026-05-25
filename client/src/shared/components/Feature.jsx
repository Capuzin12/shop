import { useFeatureFlags } from '../context/FeatureFlagContext';

export default function Feature({ flag, fallback = null, children }) {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(flag) ? children : fallback;
}


