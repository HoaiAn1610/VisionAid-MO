import { A11yText } from '@/components/A11yText';
import { BigActionButton } from '@/components/BigActionButton';
import { Screen } from '@/components/Screen';
import { Strings } from '@/constants/strings.vi';
import { useAuthStore } from '@/stores/authStore';

// TODO(Sprint 2): form đăng nhập (Zod) + POST /api/auth/login + role guard VIU.
export default function LoginScreen() {
  const setUser = useAuthStore((s) => s.setUser);

  return (
    <Screen>
      <A11yText variant="title">{Strings.auth.loginTitle}</A11yText>
      <A11yText>{Strings.screens.notImplemented}</A11yText>
      {/* ponytail: user giả chỉ ở bản dev, xóa khi có đăng nhập thật (Sprint 2) */}
      {__DEV__ && (
        <BigActionButton
          label={Strings.auth.devBypass}
          accessibilityHint={Strings.auth.devBypassHint}
          onPress={() =>
            setUser({
              id: 'dev-user',
              email: 'dev@visionaid.local',
              fullName: 'Dev VIU',
              role: 'VisuallyImpaired',
              privacyConsentAcceptedAt: new Date().toISOString(),
            })
          }
        />
      )}
    </Screen>
  );
}
