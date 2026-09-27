import { useEffect, useState } from 'react';

import type { NetworkStatus } from '@/constants/enums';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState(NetworkMonitor.getStatus());
  useEffect(() => NetworkMonitor.subscribe(setStatus), []);
  return status;
}
