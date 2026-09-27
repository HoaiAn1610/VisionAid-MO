import { NetInfoStateType, type NetInfoState } from '@react-native-community/netinfo';

import { toNetworkStatus } from './NetworkMonitor';

const state = (over: Record<string, unknown>) =>
  ({ isConnected: true, isInternetReachable: true, details: null, ...over }) as NetInfoState;

describe('toNetworkStatus (giá trị gửi lên backend: Wifi | Mobile4G | Mobile3G | Offline)', () => {
  it.each([
    [state({ isConnected: false, type: NetInfoStateType.none }), 'Offline'],
    [state({ isInternetReachable: false, type: NetInfoStateType.wifi }), 'Offline'],
    [state({ type: NetInfoStateType.wifi }), 'Wifi'],
    [
      state({
        type: NetInfoStateType.cellular,
        details: { cellularGeneration: '3g', carrier: null, isConnectionExpensive: false },
      }),
      'Mobile3G',
    ],
    [
      state({
        type: NetInfoStateType.cellular,
        details: { cellularGeneration: '4g', carrier: null, isConnectionExpensive: false },
      }),
      'Mobile4G',
    ],
    [
      state({
        type: NetInfoStateType.cellular,
        details: { cellularGeneration: '5g', carrier: null, isConnectionExpensive: false },
      }),
      'Mobile4G',
    ],
  ])('%#', (input, expected) => {
    expect(toNetworkStatus(input)).toBe(expected);
  });
});
