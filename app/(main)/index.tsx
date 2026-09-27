import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { Strings } from '@/constants/strings.vi';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { useAuthStore } from '@/stores/authStore';
import { spacing } from '@/theme';

// TODO(Sprint 3): camera feed + radar + obstacle detection pipeline.
export default function HomeScreen() {
  const fullName = useAuthStore((s) => s.user?.fullName ?? '');
  const offline = useNetworkStatus() === 'Offline';

  useEffect(() => {
    ttsService.enqueue({ text: Strings.app.ready, priority: TtsPriority.SYSTEM });
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText variant="caption">{Strings.app.name}</ThemedText>
        <ThemedText variant="title">{Strings.home.greeting(fullName)}</ThemedText>
      </View>

      {offline && <Notice tone="info" icon="wifi-off" message={Strings.network.offline} />}

      <Button
        size="hero"
        icon="navigation-variant"
        label={Strings.home.startNavigation}
        accessibilityHint={Strings.home.startNavigationHint}
        onPress={() =>
          ttsService.enqueue({
            text: Strings.screens.notImplemented,
            priority: TtsPriority.FEEDBACK,
          })
        }
      />
      <Button
        variant="secondary"
        icon="cog"
        label={Strings.screens.settings}
        accessibilityHint={Strings.home.settingsHint}
        onPress={() => router.push('/settings')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
});
