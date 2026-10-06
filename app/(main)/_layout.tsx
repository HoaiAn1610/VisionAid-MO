import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { refreshEmergencyContacts } from '@/features/emergency/emergencyContacts';
import { useArrivalNotifications } from '@/features/location/useArrivalNotifications';
import { startOfflineSyncLoop } from '@/features/sync/offlineSync';
import { startFcm } from '@/services/fcm/FcmService';
import { VoiceProvider } from '@/features/voice-commands/VoiceProvider';
import { startOnDeviceSpeechSetup } from '@/services/speech/onDeviceSpeech';

// TODO: Global overlays — SOS overlay, System Alerts.
export default function MainLayout() {
  // Chỉ chạy khi đã đăng nhập: đồng bộ hàng đợi offline (phiên dẫn đường, voice log…)
  useEffect(() => startOfflineSyncLoop(), []);
  // Danh bạ khẩn cấp vào cache SQLite để SOS gọi được cả khi offline
  useEffect(() => refreshEmergencyContacts(), []);
  // Lệnh giọng nói offline: kiểm tra / tải gói tiếng Việt nhận dạng trên máy (ADR 0002)
  useEffect(() => startOnDeviceSpeechSetup(), []);
  // Thông báo đến nơi quen qua SignalR (ngắt khi rời layout = đăng xuất / hết phiên)
  useArrivalNotifications();
  // FCM: thông báo khi app đang mở + cập nhật token khi Firebase đổi
  useEffect(() => startFcm(), []);

  return (
    <VoiceProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </VoiceProvider>
  );
}
