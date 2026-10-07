import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { Strings } from '@/constants/strings.vi';
import { consumeSosConfirmation } from '@/features/emergency/sosConfirmation';
import { useSos } from '@/features/emergency/useSos';
import { colors, radius, spacing } from '@/theme';

export default function EmergencyScreen() {
  // Chỉ lệnh giọng nói đã xác nhận trong app mới gửi ngay; mọi cách mở khác phải xác nhận lại
  const [confirmedByVoice] = useState(() => consumeSosConfirmation());
  const sos = useSos(confirmedByVoice);
  const sending = sos.phase === 'sending';
  const done = sos.phase === 'done';

  return (
    <Screen scroll>
      <Header title={Strings.emergency.title} back />
      {sos.message ? (
        <View style={styles.result} accessible>
          <ThemedText variant="title">{sos.message}</ThemedText>
        </View>
      ) : null}
      {sos.phase === 'confirming' ? (
        <>
          <Button
            size="hero"
            variant="danger"
            icon="alarm-light"
            label={Strings.emergency.confirm}
            accessibilityHint={Strings.emergency.confirmHint}
            onPress={sos.confirm}
          />
          <Button
            variant="secondary"
            icon="close"
            label={Strings.emergency.cancel}
            accessibilityHint={Strings.emergency.cancelHint}
            onPress={sos.cancel}
          />
        </>
      ) : (
        <Button
          size="hero"
          variant="danger"
          icon="alarm-light"
          label={
            sending
              ? Strings.emergency.sending
              : done
                ? Strings.emergency.again
                : Strings.emergency.open
          }
          accessibilityHint={done ? Strings.emergency.againHint : Strings.emergency.openHint}
          loading={sending}
          disabled={sending}
          onPress={() => void sos.start()}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  result: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
});
