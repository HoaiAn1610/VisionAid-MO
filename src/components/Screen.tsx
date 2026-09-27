import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

interface Props {
  children: ReactNode;
  /** Nội dung dài hoặc có bàn phím (form) → cuộn được. */
  scroll?: boolean;
}

export function Screen({ children, scroll = false }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      {scroll ? (
        <KeyboardAvoidingView behavior="height" style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.flex, styles.content]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, gap: spacing.lg },
});
