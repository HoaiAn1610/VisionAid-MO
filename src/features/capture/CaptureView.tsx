import { StyleSheet, View } from 'react-native';

import { Button, type IconName } from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { DetectionCamera } from '@/features/obstacle-detection/DetectionCamera';
import { colors, radius, spacing } from '@/theme';

import type { useCaptureAndSpeak } from './useCaptureAndSpeak';

interface Props {
  capture: ReturnType<typeof useCaptureAndSpeak>;
  icon: IconName;
  captureLabel: string;
  captureHint: string;
  busyLabel: string;
  againLabel: string;
  againHint: string;
}

/** Camera + nút chụp lớn nửa dưới màn hình (§5.2); kết quả hiện chữ lớn + nút chụp lại. */
export function CaptureView({ capture: c, icon, ...labels }: Props) {
  if (c.phase === 'result') {
    return (
      <>
        <View style={styles.result} accessible>
          <ThemedText variant="title">{c.message}</ThemedText>
        </View>
        <Button
          size="hero"
          icon={icon}
          label={labels.againLabel}
          accessibilityHint={labels.againHint}
          onPress={c.again}
        />
      </>
    );
  }
  const busy = c.phase === 'busy';
  return (
    <>
      {c.hasPermission ? <DetectionCamera cameraRef={c.camera} enabled /> : null}
      <Button
        size="hero"
        icon={icon}
        label={busy ? labels.busyLabel : labels.captureLabel}
        accessibilityHint={labels.captureHint}
        loading={busy}
        disabled={busy || !c.hasPermission}
        onPress={() => void c.capture()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  result: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
});
