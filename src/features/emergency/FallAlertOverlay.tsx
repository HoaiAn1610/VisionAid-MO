import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { Strings } from '@/constants/strings.vi';
import { useAccessibilityFocusOnShow } from '@/services/a11y/screenReader';
import { colors, spacing } from '@/theme';

import { fallAlert, useFallAlertState } from './fallAlertService';

/**
 * Đếm ngược té ngã (FE-28): phủ toàn màn hình, CHẠM BẤT KỲ ĐÂU = hủy (cách hủy chính, luôn hoạt
 * động kể cả khi mic không nghe được). Lớp phủ trong cửa sổ chính như VoiceSheet (không dùng Modal).
 */
export function FallAlertOverlay() {
  const { phase, remaining } = useFallAlertState();
  const ref = useRef<View>(null);
  const active = phase === 'countdown';

  // TalkBack: phần dưới đã bị ẩn → đưa tiêu điểm lên lớp phủ, chạm hai lần ở đâu cũng là hủy
  useAccessibilityFocusOnShow(ref, active);

  if (!active) return null;
  return (
    <Pressable
      ref={ref}
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
