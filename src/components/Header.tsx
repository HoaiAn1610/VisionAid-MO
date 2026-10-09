import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Strings } from '@/constants/strings.vi';
import { colors, radius, spacing, touch } from '@/theme';

import { ThemedText } from './ThemedText';

interface Props {
  title: string;
  /** Hiện nút "Quay lại" (ngoài cử chỉ back của Android) — dễ tìm với TalkBack. */
  back?: boolean;
}

export function Header({ title, back = false }: Props) {
  return (
    <View style={styles.row}>
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={Strings.common.back}
          accessibilityHint={Strings.common.backHint}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="arrow-left" size={32} color={colors.text} />
        </Pressable>
      )}
      <ThemedText variant="title" style={styles.title} accessibilityRole="header">
        {title}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: {
    width: touch.min,
    height: touch.min,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  pressed: { backgroundColor: colors.surface },
  title: { flex: 1 },
});
