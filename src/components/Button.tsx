import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { HapticService } from '@/services/haptics/HapticService';
import { colors, radius, spacing, touch } from '@/theme';

import { ThemedText } from './ThemedText';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const variants = {
  primary: {
    bg: colors.primary,
    pressed: colors.primaryPressed,
    fg: colors.onPrimary,
    border: colors.primary,
  },
  secondary: {
    bg: colors.surfaceRaised,
    pressed: colors.surface,
    fg: colors.text,
    border: colors.border,
  },
  danger: {
    bg: colors.danger,
    pressed: colors.dangerSurface,
    fg: colors.onDanger,
    border: colors.danger,
  },
} as const;

interface Props {
  label: string;
  accessibilityHint: string;
  onPress: () => void;
  variant?: keyof typeof variants;
  /** `hero`: nút hành động chính chiếm phần lớn màn hình (CLAUDE.md §5.2). */
  size?: 'lg' | 'hero';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  accessibilityHint,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  loading = false,
  disabled = false,
  style,
}: Props) {
  const v = variants[variant];
  const hero = size === 'hero';
  const inactive = disabled || loading;
  const fg = loading && variant === 'danger' ? colors.text : v.fg;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        void HapticService.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        hero ? styles.hero : styles.lg,
        { backgroundColor: pressed ? v.pressed : v.bg, borderColor: v.border },
        pressed && styles.pressed,
        disabled && !loading && styles.disabled,
        style,
      ]}
    >
      <View
        style={hero ? styles.heroContent : styles.lgContent}
        importantForAccessibility="no-hide-descendants"
      >
        {loading ? (
          <ActivityIndicator color={fg} size={hero ? 'large' : 'small'} />
        ) : (
          icon && <MaterialCommunityIcons name={icon} size={hero ? 64 : 28} color={fg} />
        )}
        <ThemedText variant={hero ? 'title' : 'headline'} style={[styles.label, { color: fg }]}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 2,
    justifyContent: 'center',
  },
  lg: { minHeight: touch.large, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  hero: { flex: 1, minHeight: touch.large * 3, padding: spacing.xl },
  lgContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  heroContent: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  label: { textAlign: 'center', flexShrink: 1 },
  pressed: { transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
});
