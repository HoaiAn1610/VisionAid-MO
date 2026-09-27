import { A11yText } from '@/components/A11yText';
import { BigActionButton } from '@/components/BigActionButton';
import { Screen } from '@/components/Screen';
import { Strings } from '@/constants/strings.vi';
import { useSignOut } from '@/features/auth/useAuthActions';

// TODO(Sprint 8): TTS preferences, detection mode, profile, đổi mật khẩu.
export default function SettingsScreen() {
  const signOut = useSignOut();

  return (
    <Screen>
      <A11yText variant="title">{Strings.screens.settings}</A11yText>
      <BigActionButton
        label={Strings.auth.logoutButton}
        accessibilityHint={Strings.auth.logoutHint}
        variant="danger"
        onPress={() => signOut.mutate()}
        disabled={signOut.isPending}
      />
    </Screen>
  );
}
