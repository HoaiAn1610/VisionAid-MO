import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { HapticService } from '@/services/haptics/HapticService';

import { Colors, FontSize, MIN_TOUCH_SIZE } from './theme';

interface Props {
  label: string;
  accessibilityHint: string;
  onPress: () => void;
  variant?: 'primary' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Nút lớn chiếm nhiều diện tích — dùng cho action chính. Luôn có a11y label/hint/role + haptic. */
export function BigActionButton({
  label,
  accessibilityHint,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: Props) {
  const isDanger = variant === 'danger';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        void HapticService.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: isDanger ? Colors.danger : Colors.primary },
        (pressed || disabled) && styles.dimmed,
        style,
      ]}
    >
      <Text style={[styles.label, { color: isDanger ? Colors.onDanger : Colors.onPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH_SIZE * 2,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dimmed: { opacity: 0.6 },
  label: { fontSize: FontSize.button, fontWeight: '700', textAlign: 'center' },
});
