import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { startOfflineSyncLoop } from '@/features/sync/offlineSync';
import { VoiceProvider } from '@/features/voice-commands/VoiceProvider';
import { startOnDeviceSpeechSetup } from '@/services/speech/onDeviceSpeech';

// TODO: Global overlays — SOS overlay, System Alerts.
export default function MainLayout() {
  // Chỉ chạy khi đã đăng nhập: đồng bộ hàng đợi offline (phiên dẫn đường, voice log…)
  useEffect(() => startOfflineSyncLoop(), []);
  // Lệnh giọng nói offline: kiểm tra / tải gói tiếng Việt nhận dạng trên máy (ADR 0002)
  useEffect(() => startOnDeviceSpeechSetup(), []);

  return (
    <VoiceProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </VoiceProvider>
  );
}
