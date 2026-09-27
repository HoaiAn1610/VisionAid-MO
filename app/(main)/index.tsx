import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { Strings } from '@/constants/strings.vi';
import { DetectionCamera } from '@/features/obstacle-detection/DetectionCamera';
import { useObstacleNavigation } from '@/features/obstacle-detection/useObstacleNavigation';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { useAuthStore } from '@/stores/authStore';
import { colors, radius, spacing } from '@/theme';

// TODO(Sprint 4): kích hoạt bằng giọng nói ("bắt đầu", "dừng lại").
export default function HomeScreen() {
  const fullName = useAuthStore((s) => s.user?.fullName ?? '');
  const offline = useNetworkStatus() === 'Offline';
  const nav = useObstacleNavigation();

  useEffect(() => {
    ttsService.enqueue({ text: Strings.app.ready, priority: TtsPriority.SYSTEM });
  }, []);

  if (nav.active) {
    return (
      <Screen>
        <View style={styles.status} accessible>
          <ThemedText variant="caption">{Strings.navigation.active}</ThemedText>
          <ThemedText variant="title">
            {nav.lastAnnouncement ?? Strings.navigation.clear}
          </ThemedText>
        </View>
        <DetectionCamera frameProcessor={nav.frameProcessor} enabled={nav.active} />
        <Button
          variant="danger"
          icon="stop-circle"
          label={Strings.navigation.stop}
          accessibilityHint={Strings.navigation.stopHint}
          onPress={nav.stop}
          style={styles.stop}
        />
      </Screen>
    );
  }

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
        onPress={() => void nav.start()}
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
  status: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  // Nút dừng chiếm phần dưới màn hình — dễ chạm trúng khi đang đi (CLAUDE.md §5.2)
  stop: { minHeight: 120 },
});
