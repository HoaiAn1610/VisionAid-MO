import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { Strings } from '@/constants/strings.vi';
import { DetectionCamera } from '@/features/obstacle-detection/DetectionCamera';
import { useQrScanner } from '@/features/qr/useQrScanner';
import { colors, radius, spacing } from '@/theme';

// TODO(Sprint 5, chờ GAP-3): đọc chữ (OCR) trên cùng màn hình
export default function QrScannerScreen() {
  const { via } = useLocalSearchParams<{ via?: string }>();
  const qr = useQrScanner(via === 'voice' ? 'VoiceCommand' : 'Tap');

  return (
    <Screen>
      <Header title={Strings.qr.title} back />
      {qr.phase === 'scanning' ? (
        <>
          <Notice tone="info" icon="qrcode-scan" message={Strings.qr.aim} />
          {qr.hasPermission ? <DetectionCamera codeScanner={qr.codeScanner} enabled /> : null}
        </>
      ) : (
        <>
          <View style={styles.result} accessible>
            <ThemedText variant="title">{qr.info?.speech}</ThemedText>
          </View>
          {qr.info?.url ? (
            <Button
              icon="open-in-new"
              label={Strings.qr.openLink}
              accessibilityHint={Strings.qr.openLinkHint}
              onPress={qr.openLink}
            />
          ) : null}
          <Button
            variant="secondary"
            icon="qrcode-scan"
            label={Strings.qr.scanAgain}
            accessibilityHint={Strings.qr.scanAgainHint}
            onPress={qr.scanAgain}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  result: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
});
