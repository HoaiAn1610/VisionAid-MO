import type { TextStyle } from 'react-native';

// Nguồn sự thật DUY NHẤT cho giá trị hình ảnh (expo-design-system). Screen không hard-code màu/cỡ chữ.
// App khóa giao diện tối (app.config.ts → userInterfaceStyle: 'dark') nên token là tĩnh.
// Tương phản WCAG trên nền `background`: text 19.7:1, textSecondary 12.2:1, primary 13.9:1, danger 6.4:1.

export const colors = {
  background: '#0B0B0C',
  surface: '#17181B',
  surfaceRaised: '#23252A',
  border: '#7A7E87', // viền ô nhập: ≥ 3:1 với nền (WCAG 1.4.11)
  text: '#FFFFFF',
  textSecondary: '#C9CCD1',
  primary: '#FFD60A', // vàng — màu nhận diện, dễ thấy nhất với thị lực kém
  onPrimary: '#0B0B0C',
  primaryPressed: '#E6BF00',
  danger: '#FF5A4F',
  dangerSurface: '#3A1512',
  onDanger: '#0B0B0C',
  success: '#4ADE80',
  focus: '#FFD60A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  full: 9999,
} as const;

/** Vùng chạm tối thiểu — lớn hơn chuẩn 48dp vì người dùng không nhìn rõ mục tiêu. */
export const touch = {
  min: 56,
  large: 72,
} as const;

// Tên font = tên file nhúng (plugin expo-font trên Android). Không dùng fontWeight với font tĩnh.
const font = {
  regular: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
} as const;

export const type = {
  display: { fontFamily: font.bold, fontSize: 40, lineHeight: 48, color: colors.text },
  title: { fontFamily: font.bold, fontSize: 30, lineHeight: 38, color: colors.text },
  headline: { fontFamily: font.bold, fontSize: 24, lineHeight: 32, color: colors.text },
  body: { fontFamily: font.regular, fontSize: 20, lineHeight: 30, color: colors.text },
  label: { fontFamily: font.bold, fontSize: 18, lineHeight: 26, color: colors.text },
  caption: { fontFamily: font.regular, fontSize: 17, lineHeight: 24, color: colors.textSecondary },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export const motion = {
  fast: 120,
} as const;
