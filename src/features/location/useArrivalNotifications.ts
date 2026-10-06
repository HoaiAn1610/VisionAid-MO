import { useEffect } from 'react';
import { AppState } from 'react-native';

import { HapticService } from '@/services/haptics/HapticService';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import { locationHub } from '@/services/signalr/LocationHubClient';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';

import { createArrivalAnnouncer } from './arrivalNotice';

/** Dùng chung cho SignalR và FCM (Sprint 6, FCM) để cùng một sự kiện chỉ đọc một lần. */
export const announceArrival = createArrivalAnnouncer((text) => {
  ttsService.enqueue({ text, priority: TtsPriority.SYSTEM });
  void HapticService.success();
});

/**
 * Nhận "đã đến nơi quen" qua SignalR khi đã đăng nhập (BR-32). Rời layout chính (đăng xuất /
 * hết phiên) → ngắt kết nối. Kết nối lại khi app về foreground hoặc có mạng lại (§11).
 */
export function useArrivalNotifications(): void {
  useEffect(() => {
    locationHub.start(announceArrival);
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void locationHub.ensureConnected();
    });
    const offNetwork = NetworkMonitor.subscribe((status) => {
      if (status !== 'Offline') void locationHub.ensureConnected();
    });
    return () => {
      app.remove();
      offNetwork();
      void locationHub.stop();
    };
  }, []);
}
