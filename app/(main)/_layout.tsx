import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { startNavigationSyncLoop } from '@/features/obstacle-detection/navigationSession';
import { startOnDeviceSpeechSetup } from '@/services/speech/onDeviceSpeech';

// TODO: Global overlays — Voice Bottom Sheet, SOS overlay, System Alerts.
export default function MainLayout() {
  // Chỉ chạy khi đã đăng nhập: đồng bộ phiên dẫn đường / detection event còn tồn trong máy
  useEffect(() => startNavigationSyncLoop(), []);
  // Lệnh giọng nói offline: kiểm tra / tải gói tiếng Việt nhận dạng trên máy (ADR 0002)
  useEffect(() => startOnDeviceSpeechSetup(), []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
