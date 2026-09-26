import { A11yText } from '@/components/A11yText';
import { Screen } from '@/components/Screen';
import { Strings } from '@/constants/strings.vi';

// TODO(Sprint 2): form đăng nhập (Zod) + POST /api/auth/login + role guard VIU.
export default function LoginScreen() {
  return (
    <Screen>
      <A11yText variant="title">{Strings.auth.loginTitle}</A11yText>
      <A11yText>{Strings.screens.notImplemented}</A11yText>
    </Screen>
  );
}
