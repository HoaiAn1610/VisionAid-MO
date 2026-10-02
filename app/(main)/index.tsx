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
import { useVoiceCommand } from '@/features/voice-commands/useVoiceCommand';
import { VoiceSheet } from '@/features/voice-commands/VoiceSheet';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { useAuthStore } from '@/stores/authStore';
import { colors, radius, spacing } from '@/theme';

export default function HomeScreen() {
  const fullName = useAuthStore((s) => s.user?.fullName ?? '');
  const offline = useNetworkStatus() === 'Offline';
  const nav = useObstacleNavigation();
  const voice = useVoiceCommand({
    active: nav.active,
    start: () => void nav.start(),
    stop: nav.stop,
    openQrScanner: () => router.push({ pathname: '/ocr', params: { via: 'voice' } }),
  });
  const voiceButton = (
    <Button
      variant="secondary"
      icon="microphone"
      label={Strings.voice.button}
      accessibilityHint={Strings.voice.buttonHint}
      onPress={() => void voice.start()}
    />
  );
  const voiceSheet = <VoiceSheet phase={voice.phase} heard={voice.heard} onCancel={voice.cancel} />;

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
        {voiceButton}
        <Button
          variant="danger"
          icon="stop-circle"
          label={Strings.navigation.stop}
          accessibilityHint={Strings.navigation.stopHint}
          onPress={nav.stop}
          style={styles.stop}
        />
        {voiceSheet}
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
      {voiceButton}
      <Button
        variant="secondary"
        icon="qrcode-scan"
        label={Strings.qr.openScanner}
        accessibilityHint={Strings.qr.openScannerHint}
        onPress={() => router.push('/ocr')}
      />
      <Button
        variant="secondary"
        icon="cog"
        label={Strings.screens.settings}
        accessibilityHint={Strings.home.settingsHint}
        onPress={() => router.push('/settings')}
      />
      {voiceSheet}
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
