import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { Strings } from '@/constants/strings.vi';
import { colors, spacing } from '@/theme';

import { callService, useCallState } from './callService';

/**
 * Lớp phủ khi có cuộc gọi (§9.10): toàn màn hình, một nút lớn "Kết thúc cuộc gọi". Người dùng không
 * cần nhìn — phím âm lượng cũng kết thúc. Không hiện video (VIU chỉ gửi camera, nghe tiếng).
 */
export function CallOverlay() {
  const { phase } = useCallState();
  if (phase === 'idle') return null;
  return (
    <View
      style={styles.overlay}
      accessibilityViewIsModal
      accessibilityLabel={Strings.call.overlayLabel}
    >
      <ThemedText variant="title" style={styles.text}>
        {Strings.call.phase[phase]}
      </ThemedText>
      <Button
        size="hero"
        variant="danger"
        icon="phone-hangup"
        label={Strings.call.endButton}
        accessibilityHint={Strings.call.endHint}
        onPress={() => void callService.hangUp()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.xl,
  },
  text: { textAlign: 'center' },
});
