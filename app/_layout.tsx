import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthBootstrap } from '@/features/auth/useAuthBootstrap';
// Đăng ký task GPS nền ngay khi nạp app (Android có thể gọi task khi app đã tắt)
import '@/services/location/gpsTracking';
// Đăng ký handler FCM khi app ở nền / đã tắt
import '@/services/fcm/FcmService';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import { useAuthStore } from '@/stores/authStore';

// Giữ splash tới khi biết trạng thái đăng nhập — tránh màn hình trống, im lặng lúc khởi động.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { retry: 1, networkMode: 'offlineFirst' } } }),
  );
  const status = useAuthStore((s) => s.status);

  useAuthBootstrap();

  useEffect(() => {
    if (status === 'loading') return;
    const hide = () => SplashScreen.hideAsync().catch(() => undefined);
    void hide();
    // Mở app lúc máy đang khóa ("Ok Google, mở VisionAid"): hideAsync khi Activity chưa hiện là no-op
    // → splash che app cả sau khi mở khóa. Gọi lại mỗi khi app ra foreground.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void hide();
    });
    return () => sub.remove();
  }, [status]);

  useEffect(() => {
    NetworkMonitor.start();
    return () => NetworkMonitor.stop();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
          <Stack.Protected guard={status === 'signedOut' || status === 'needsConsent'}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={status === 'signedIn'}>
            <Stack.Screen name="(main)" />
          </Stack.Protected>
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
