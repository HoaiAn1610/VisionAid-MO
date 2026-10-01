import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { startNavigationSyncLoop } from '@/features/obstacle-detection/navigationSession';

// TODO: Global overlays — Voice Bottom Sheet, SOS overlay, System Alerts.
export default function MainLayout() {
  // Chỉ chạy khi đã đăng nhập: đồng bộ phiên dẫn đường / detection event còn tồn trong máy
  useEffect(() => startNavigationSyncLoop(), []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
