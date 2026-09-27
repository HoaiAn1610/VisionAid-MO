import { Text, type TextProps } from 'react-native';

import { type, type TypeVariant } from '@/theme';

interface Props extends TextProps {
  variant?: TypeVariant;
}

/** Mọi chữ trong app đi qua đây — screen không đặt fontSize/fontFamily. Giữ scale theo cỡ chữ hệ thống. */
export function ThemedText({ variant = 'body', style, ...rest }: Props) {
  const isHeading = variant === 'display' || variant === 'title' || variant === 'headline';
  return (
    <Text
      accessibilityRole={isHeading ? 'header' : 'text'}
      style={[type[variant], style]}
      {...rest}
    />
  );
}
