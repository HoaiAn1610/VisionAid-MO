import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { Strings } from '@/constants/strings.vi';
import { colors, spacing } from '@/theme';

import { fallAlert, useFallAlertState } from './fallAlertService';

/**
 * Đếm ngược té ngã (FE-28): phủ toàn màn hình, CHẠM BẤT KỲ ĐÂU = hủy (cách hủy chính, luôn hoạt
 * động kể cả khi mic không nghe được). Lớp phủ trong cửa sổ chính như VoiceSheet (không dùng Modal).
 */
export function FallAlertOverlay() {
  const { phase, remaining } = useFallAlertState();
  if (phase !== 'countdown') return null;
  return (
    <Pressable
      style={styles.overlay}
      onPress={() => fallAlert.cancel()}
      accessibilityRole="button"
      accessibilityLabel={Strings.fall.overlayLabel}
      accessibilityHint={Strings.fall.overlayHint}
      accessibilityViewIsModal
    >
      <View style={styles.content}>
        <ThemedText variant="title" style={styles.text}>
          {Strings.fall.detected}
        </ThemedText>
        <ThemedText variant="title" style={styles.count}>
          {remaining}
        </ThemedText>
        <ThemedText variant="body" style={styles.text}>
          {Strings.fall.countdown(remaining)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  content: { alignItems: 'center', gap: spacing.lg },
  text: { color: colors.onDanger, textAlign: 'center' },
  count: { color: colors.onDanger, fontSize: 120, lineHeight: 130 },
});
