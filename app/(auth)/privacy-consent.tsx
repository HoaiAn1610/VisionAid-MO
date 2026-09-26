import { A11yText } from '@/components/A11yText';
import { Screen } from '@/components/Screen';
import { Strings } from '@/constants/strings.vi';

// TODO(Sprint 2): đọc chính sách bằng TTS + POST /api/auth/accept-privacy-policy.
export default function PrivacyConsentScreen() {
  return (
    <Screen>
      <A11yText variant="title">{Strings.privacy.title}</A11yText>
      <A11yText>{Strings.screens.notImplemented}</A11yText>
    </Screen>
  );
}
