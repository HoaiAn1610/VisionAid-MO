import { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { A11yText } from '@/components/A11yText';
import { BigActionButton } from '@/components/BigActionButton';
import { Screen } from '@/components/Screen';
import { Strings } from '@/constants/strings.vi';
import { useAcceptPrivacy } from '@/features/auth/useAuthActions';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';

const readPolicy = () =>
  ttsService.enqueue({ text: Strings.privacy.content, priority: TtsPriority.INFO });

export default function PrivacyConsentScreen() {
  const accept = useAcceptPrivacy();

  // Audio-first: đọc chính sách ngay khi vào màn hình (UC-20)
  useEffect(() => {
    readPolicy();
  }, []);

  return (
    <Screen>
      <A11yText variant="title">{Strings.privacy.title}</A11yText>
      <ScrollView style={styles.policy}>
        <A11yText>{Strings.privacy.content}</A11yText>
      </ScrollView>
      <BigActionButton
        label={Strings.privacy.readAgainButton}
        accessibilityHint={Strings.privacy.readAgainHint}
        onPress={readPolicy}
      />
      <BigActionButton
        label={Strings.privacy.acceptButton}
        accessibilityHint={Strings.privacy.acceptHint}
        onPress={() => accept.mutate()}
        disabled={accept.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  policy: { flex: 1 },
});
