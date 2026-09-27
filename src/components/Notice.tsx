import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import type { IconName } from './Button';
import { ThemedText } from './ThemedText';

const tones = {
  danger: { bg: colors.dangerSurface, accent: colors.danger, icon: 'alert-circle' },
  info: { bg: colors.surfaceRaised, accent: colors.textSecondary, icon: 'information' },
  success: { bg: colors.surfaceRaised, accent: colors.success, icon: 'check-circle' },
} as const satisfies Record<string, { bg: string; accent: string; icon: IconName }>;

interface Props {
  message: string;
  tone?: keyof typeof tones;
  icon?: IconName;
  /** Lỗi cần TalkBack đọc ngay. Tắt khi TTS của app đã đọc câu này để tránh đọc trùng. */
  live?: boolean;
}

/** Thông báo trạng thái: icon + chữ, không truyền đạt chỉ bằng màu (CLAUDE.md §5.3). */
export function Notice({ message, tone = 'info', icon, live = false }: Props) {
  const t = tones[tone];
  return (
    <View
      style={[styles.box, { backgroundColor: t.bg, borderLeftColor: t.accent }]}
      accessible
      accessibilityLiveRegion={live ? 'assertive' : 'none'}
    >
      <MaterialCommunityIcons name={icon ?? t.icon} size={28} color={t.accent} />
      <ThemedText style={styles.text}>{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderLeftWidth: 6,
  },
  text: { flex: 1 },
});
