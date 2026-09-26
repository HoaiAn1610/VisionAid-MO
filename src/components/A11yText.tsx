import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, FontSize } from './theme';

interface Props extends TextProps {
  variant?: 'body' | 'title';
}

export function A11yText({ variant = 'body', style, ...rest }: Props) {
  return (
    <Text
      accessibilityRole={variant === 'title' ? 'header' : 'text'}
      style={[styles.base, variant === 'title' ? styles.title : styles.body, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { color: Colors.text },
  body: { fontSize: FontSize.body },
  title: { fontSize: FontSize.title, fontWeight: '700' },
});
