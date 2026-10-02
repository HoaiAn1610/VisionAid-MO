// Màn tạm, CHỈ ở bản dev: đo STT trên máy thật cho ADR 0002. Gỡ khi có Voice Bottom Sheet (task 6).
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { Strings } from '@/constants/strings.vi';
import { matchIntent } from '@/features/voice-commands/intentMatcher';
import { recognizeWithGoogle } from '@/services/speech/engines';
import { isOnDeviceSpeechReady } from '@/services/speech/onDeviceSpeech';
import { createEchoGuard } from '@/services/speech/echoGuard';
import { createSpeechService, speechService } from '@/services/speech/SpeechService';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { logger } from '@/utils/logger';
import { colors, radius, spacing } from '@/theme';

// Ép đi nhánh offline (Google nhận dạng ngay trên máy) dù đang có mạng
const offlineOnly = createSpeechService({
  google: recognizeWithGoogle,
  isOnline: () => false,
  isOfflineReady: isOnDeviceSpeechReady,
  tts: ttsService,
  createGuard: () => createEchoGuard(),
});

export default function VoiceLabScreen() {
  const [last, setLast] = useState('');
  const [busy, setBusy] = useState(false);
  const [locales, setLocales] = useState('');

  useEffect(() => {
    ExpoSpeechRecognitionModule.getSupportedLocales({
      androidRecognitionServicePackage: 'com.google.android.as',
    })
      .then((r) => {
        const line = `on-device: ${ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()} | installed: ${r.installedLocales.join(',') || '-'} | vi in supported: ${r.locales.some((l) => l.startsWith('vi'))}`;
        logger.info(`VOICE_LAB ${line}`);
        setLocales(line);
      })
      .catch((e: unknown) => setLocales(String(e)));
  }, []);

  const run = async (svc: typeof speechService) => {
    if (busy) return;
    setBusy(true);
    try {
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      const t0 = Date.now();
      const out = await svc.listenOnce();
      const intent = matchIntent(out.alternatives);
      const top = out.alternatives[0];
      const line = `${out.engine} | "${top?.transcript ?? ''}" conf=${top?.confidence ?? '-'} → ${intent?.intent ?? 'NONE'} | xử lý ${out.processingTimeMs} ms, tổng ${Date.now() - t0} ms${out.discardedAsEcho ? ' | ECHO' : ''}`;
      logger.info(`VOICE_LAB ${line}`);
      setLast(line);
      ttsService.enqueue({
        text: intent ? (intent.keywords[0] ?? '') : Strings.voice.notUnderstood,
        priority: TtsPriority.FEEDBACK,
      });
    } catch (e) {
      logger.warn('VOICE_LAB failed', e);
      setLast(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={Strings.settings.voiceLab} back />
      <Button
        icon="google"
        label={Strings.voiceLab.google}
        accessibilityHint={Strings.voiceLab.hint}
        onPress={() => void run(speechService)}
        loading={busy}
      />
      <ThemedText variant="caption">{locales}</ThemedText>
      <Button
        variant="secondary"
        icon="cellphone-check"
        label={Strings.voiceLab.onDevice}
        accessibilityHint={Strings.voiceLab.hint}
        onPress={() => void run(offlineOnly)}
        disabled={busy}
      />
      <View style={styles.result} accessible>
        <ThemedText variant="body">{last}</ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  result: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
});
