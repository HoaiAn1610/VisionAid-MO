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
import { ensureCallPermission } from '@/features/emergency/callContact';
import { useVoice } from '@/features/voice-commands/VoiceProvider';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { ensureLocationPermission, warnIfLocationServicesOff } from '@/services/location/gps';
import { setGpsMode } from '@/services/location/gpsTracking';
import { useAuthStore } from '@/stores/authStore';
import { colors, radius, spacing } from '@/theme';

export default function HomeScreen() {
  const fullName = useAuthStore((s) => s.user?.fullName ?? '');
  const offline = useNetworkStatus() === 'Offline';
  const nav = useObstacleNavigation();
  const voice = useVoice();
  const { registerNavigation } = voice;
  const { active, start: startNavigation, stop: stopNavigation } = nav;
  // Chia sẻ vị trí: dày khi dẫn đường (xin quyền theo ngữ cảnh lúc bắt đầu), thưa ngoài phiên
  useEffect(() => {
    void (async () => {
      if (active) await ensureCallPermission(); // té ngã offline có thể tự gọi người thân
      if (active && !(await ensureLocationPermission())) return;
      if (active) await warnIfLocationServicesOff();
      await setGpsMode(active ? 'session' : 'low-power');
    })();
  }, [active]);
  // Lệnh giọng nói (overlay toàn cục) điều khiển dẫn đường qua handle này
  useEffect(() => {
    registerNavigation({ active, start: () => void startNavigation(), stop: stopNavigation });
    return () => registerNavigation(null);
  }, [registerNavigation, active, startNavigation, stopNavigation]);
  const voiceButton = (
    <Button
      variant="secondary"
      icon="microphone"
      label={Strings.voice.button}
      accessibilityHint={Strings.voice.buttonHint}
      onPress={() => voice.listen()}
    />
  );

  if (nav.active) {
    return (
      <Screen>
        <View style={styles.status} accessible>
          <ThemedText variant="caption">{Strings.navigation.active}</ThemedText>
          <ThemedText variant="title">
            {nav.lastAnnouncement ?? Strings.navigation.clear}
          </ThemedText>
        </View>
        <DetectionCamera
          frameProcessor={nav.frameProcessor}
          cameraRef={nav.cameraRef}
          snapshotOnly
          enabled={nav.active}
        />
        {voiceButton}
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
    <Screen scroll>
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
        variant="danger"
        icon="alarm-light"
        label={Strings.emergency.open}
        accessibilityHint={Strings.emergency.openHint}
        onPress={() => router.push('/emergency')}
      />
      <Button
        variant="secondary"
        icon="text-recognition"
        label={Strings.ocr.open}
        accessibilityHint={Strings.ocr.openHint}
        onPress={() => router.push('/read-text')}
      />
      <Button
        variant="secondary"
        icon="account-search"
        label={Strings.face.open}
        accessibilityHint={Strings.face.openHint}
        onPress={() => router.push('/face')}
      />
      <Button
        variant="secondary"
        icon="map-marker-radius"
        label={Strings.location.open}
        accessibilityHint={Strings.location.openHint}
        onPress={() => router.push('/location')}
      />
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
