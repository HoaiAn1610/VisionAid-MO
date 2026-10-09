import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { Strings } from '@/constants/strings.vi';
import { useSignOut } from '@/features/auth/useAuthActions';
import { settingsActions, usePreferenceValues } from '@/features/settings/useSettingsActions';
import { useAuthStore } from '@/stores/authStore';
import { colors, radius, spacing } from '@/theme';

/** Hồ sơ & Cài đặt (FE-02, FE-11, UC-3..12): tốc độ / âm lượng đọc, chế độ cảnh báo, đổi mật khẩu. */
export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useSignOut();
  const { speedRate, volumeLevel, detectionMode, batterySaver } = usePreferenceValues();

  return (
    <Screen scroll>
      <Header title={Strings.screens.settings} back />

      <View style={styles.section} accessible>
        <ThemedText variant="caption">{Strings.settings.account}</ThemedText>
        <ThemedText variant="headline">{user?.fullName}</ThemedText>
        <ThemedText variant="caption">{user?.email}</ThemedText>
        {user?.phoneNumber ? (
          <ThemedText variant="caption">{Strings.settings.phone(user.phoneNumber)}</ThemedText>
        ) : null}
      </View>

      <View style={styles.section}>
        <ThemedText variant="label" accessibilityRole="header">
          {Strings.settings.speedTitle}
        </ThemedText>
        <ThemedText variant="title">{Strings.settings.speedValue(speedRate)}</ThemedText>
        <View style={styles.buttons}>
          <Button
            variant="secondary"
            icon="minus"
            label={Strings.settings.slower}
            accessibilityHint={Strings.settings.speedHint}
            onPress={() => settingsActions.changeSpeed(false)}
          />
          <Button
            variant="secondary"
            icon="plus"
            label={Strings.settings.faster}
            accessibilityHint={Strings.settings.speedHint}
            onPress={() => settingsActions.changeSpeed(true)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText variant="label" accessibilityRole="header">
          {Strings.settings.volumeTitle}
        </ThemedText>
        <ThemedText variant="title">{Strings.settings.volumeValue(volumeLevel)}</ThemedText>
        <View style={styles.buttons}>
          <Button
            variant="secondary"
            icon="volume-minus"
            label={Strings.settings.quieter}
            accessibilityHint={Strings.settings.volumeHint}
            onPress={() => settingsActions.changeVolume(false)}
          />
          <Button
            variant="secondary"
            icon="volume-plus"
            label={Strings.settings.louder}
            accessibilityHint={Strings.settings.volumeHint}
            onPress={() => settingsActions.changeVolume(true)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText variant="label" accessibilityRole="header">
          {Strings.settings.modeTitle}
        </ThemedText>
        {batterySaver ? (
          <ThemedText variant="caption">{Strings.settings.batterySaverNote}</ThemedText>
        ) : null}
        <Button
          variant={detectionMode === 'Full' ? 'primary' : 'secondary'}
          selected={detectionMode === 'Full'}
          icon="eye"
          label={Strings.settings.modeFull}
          accessibilityHint={Strings.settings.modeFullHint}
          onPress={() => settingsActions.setMode('Full')}
        />
        <Button
          variant={detectionMode === 'Minimal' ? 'primary' : 'secondary'}
          selected={detectionMode === 'Minimal'}
          icon="alert"
          label={Strings.settings.modeMinimal}
          accessibilityHint={Strings.settings.modeMinimalHint}
          onPress={() => settingsActions.setMode('Minimal')}
        />
      </View>

      <Button
        variant="secondary"
        icon="lock-reset"
        label={Strings.settings.changePassword}
        accessibilityHint={Strings.settings.changePasswordHint}
        onPress={() => router.push('/change-password')}
      />
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
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
  },
  // Xếp dọc: hai nút cạnh nhau chỉ còn ~120 px cho chữ, "Đọc chậm hơn" bị ngắt giữa từ
  buttons: { gap: spacing.sm },
});
