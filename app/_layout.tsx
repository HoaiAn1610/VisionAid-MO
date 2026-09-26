import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthBootstrap } from '@/features/auth/useAuthBootstrap';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import { useAuthStore } from '@/stores/authStore';

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { retry: 1, networkMode: 'offlineFirst' } } }),
  );
  const status = useAuthStore((s) => s.status);

  useAuthBootstrap();

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
