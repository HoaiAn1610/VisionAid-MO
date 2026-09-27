import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Strings } from '@/constants/strings.vi';
import { colors, radius, spacing, touch, type } from '@/theme';

import { ThemedText } from './ThemedText';

interface Props extends Omit<TextInputProps, 'accessibilityLabel' | 'accessibilityHint' | 'style'> {
  label: string;
  hint: string;
  /** Mật khẩu: có nút hiện/ẩn (người thị lực kém cần kiểm tra lại được đã gõ gì). */
  secure?: boolean;
  invalid?: boolean;
}

export function TextField({ label, hint, secure = false, invalid = false, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const borderColor = invalid ? colors.danger : focused ? colors.focus : colors.border;

  return (
    <View style={styles.field}>
      <ThemedText variant="label" importantForAccessibility="no">
        {label}
      </ThemedText>
      <View style={[styles.box, { borderColor }, focused && styles.focused]}>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={hint}
          accessibilityState={{ selected: focused }}
          aria-invalid={invalid}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          secureTextEntry={secure && !revealed}
          style={styles.input}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
        />
        {secure && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? Strings.auth.hidePassword : Strings.auth.showPassword}
            accessibilityHint={Strings.auth.togglePasswordHint}
            onPress={() => setRevealed((r) => !r)}
            style={styles.toggle}
            hitSlop={spacing.sm}
          >
            <MaterialCommunityIcons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={28}
              color={colors.text}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touch.large,
    borderWidth: 2,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
  },
  focused: { borderWidth: 3 },
  input: { ...type.body, flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  toggle: {
    width: touch.min,
    height: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
