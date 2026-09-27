import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { Strings } from '@/constants/strings.vi';
import { useSignOut } from '@/features/auth/useAuthActions';
import { useAuthStore } from '@/stores/authStore';
import { colors, radius, spacing } from '@/theme';

// TODO(Sprint 8): TTS preferences, detection mode, profile, đổi mật khẩu.
export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useSignOut();

  return (
    <Screen>
      <Header title={Strings.screens.settings} back />

      <View style={styles.section} accessible>
        <ThemedText variant="caption">{Strings.settings.account}</ThemedText>
        <ThemedText variant="headline">{user?.fullName}</ThemedText>
        <ThemedText variant="caption">{user?.email}</ThemedText>
      </View>

      {__DEV__ && (
        <Button
          variant="secondary"
          icon="flask-outline"
          label={Strings.settings.detectorLab}
          accessibilityHint={Strings.settings.detectorLabHint}
          onPress={() => router.push('/detector-lab')}
        />
      )}

      <View style={styles.spacer} />
      <Button
        variant="danger"
        icon="logout"
        label={Strings.auth.logoutButton}
        accessibilityHint={Strings.auth.logoutHint}
        onPress={() => signOut.mutate()}
        loading={signOut.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
  },
  spacer: { flex: 1 },
});
