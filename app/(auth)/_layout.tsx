import { Stack } from 'expo-router';

import { useAuthStore } from '@/stores/authStore';

export default function AuthLayout() {
  const status = useAuthStore((s) => s.status);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'needsConsent'}>
        <Stack.Screen name="privacy-consent" />
      </Stack.Protected>
    </Stack>
  );
}
