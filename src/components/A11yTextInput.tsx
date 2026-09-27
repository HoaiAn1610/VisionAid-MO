import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Colors, FontSize, MIN_TOUCH_SIZE } from './theme';

interface Props extends Omit<TextInputProps, 'accessibilityLabel' | 'accessibilityHint'> {
  label: string;
  hint: string;
}

/** Ô nhập có nhãn hiển thị + accessibilityLabel/Hint cho TalkBack. */
export function A11yTextInput({ label, hint, style, ...rest }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label} importantForAccessibility="no">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor="#9E9E9E"
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { color: Colors.text, fontSize: FontSize.body, fontWeight: '700' },
  input: {
    minHeight: MIN_TOUCH_SIZE * 1.5,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: Colors.text,
    backgroundColor: Colors.surface,
    fontSize: FontSize.body,
  },
});
