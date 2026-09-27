import NetInfo, { NetInfoStateType, type NetInfoState } from '@react-native-community/netinfo';

import type { NetworkStatus } from '@/constants/enums';

type Listener = (status: NetworkStatus) => void;

export function toNetworkStatus(state: NetInfoState): NetworkStatus {
  if (!state.isConnected || state.isInternetReachable === false) return 'Offline';
  if (state.type === NetInfoStateType.wifi || state.type === NetInfoStateType.ethernet) {
    return 'Wifi';
  }
  if (state.type === NetInfoStateType.cellular) {
    return state.details.cellularGeneration === '3g' ? 'Mobile3G' : 'Mobile4G';
  }
  return 'Wifi';
}

class NetworkMonitorImpl {
  private status: NetworkStatus = 'Offline';
  private listeners = new Set<Listener>();
  private unsubscribe: (() => void) | null = null;

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = NetInfo.addEventListener((state) => {
      const next = toNetworkStatus(state);
      if (next === this.status) return;
      this.status = next;
      this.listeners.forEach((l) => l(next));
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  getStatus(): NetworkStatus {
    return this.status;
  }

  isOnline(): boolean {
    return this.status !== 'Offline';
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const NetworkMonitor = new NetworkMonitorImpl();
