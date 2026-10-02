import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Linking } from 'react-native';

import { Strings } from '@/constants/strings.vi';
import { HapticService } from '@/services/haptics/HapticService';
import { OfflineSpeechUnavailableError, speechService } from '@/services/speech/SpeechService';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { useSettingsStore } from '@/stores/settingsStore';
import { logger } from '@/utils/logger';

import { startConfirmation, type ConfirmationFlow } from './confirmationFlow';
import { matchIntent } from './intentMatcher';
import { runVoiceIntent } from './runVoiceIntent';

export type VoicePhase = 'idle' | 'listening' | 'confirming';

interface NavigationControls {
  active: boolean;
  start(): void;
  stop(): void;
}

/** TalkBack đọc nội dung sheet khi mở → chờ đọc xong mới mở mic (echo guard chỉ biết TTS của app). */
const SCREEN_READER_SETTLE_MS = 1_200;

const say = (text: string, priority = TtsPriority.FEEDBACK) =>
  ttsService.enqueue({ text, priority });
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function ensureMicPermission(): Promise<boolean> {
  if ((await ExpoSpeechRecognitionModule.getPermissionsAsync()).granted) return true;
  say(Strings.voice.micExplain); // giải thích bằng TTS trước hộp thoại hệ thống (§14)
  if ((await ExpoSpeechRecognitionModule.requestPermissionsAsync()).granted) return true;
  say(Strings.voice.micDenied, TtsPriority.SYSTEM);
  await Linking.openSettings().catch((e: unknown) => logger.warn('Open settings failed', e));
  return false;
}

/**
 * Một lượt ra lệnh giọng nói (FE-09): nghe → khớp lệnh (không đoán mò, §5.8) → lệnh nguy hiểm thì
 * xác nhận 10 s (BR-14) → thực thi + TTS phản hồi.
 */
export function useVoiceCommand(navigation: NavigationControls) {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [heard, setHeard] = useState<string | null>(null);
  const busy = useRef(false);
  const cancelled = useRef(false);
  const confirmation = useRef<ConfirmationFlow | null>(null);
  const setDetectionMode = useSettingsStore((s) => s.setDetectionMode);
  const navRef = useRef(navigation);
  useEffect(() => {
    navRef.current = navigation;
  }, [navigation]);

  /** Nghe lặp tới khi người dùng trả lời hoặc hết 10 s. */
  const confirm = useCallback(async (): Promise<boolean> => {
    const flow = startConfirmation({
      prompt: Strings.voice.confirmEmergency,
      cancelledMessage: Strings.voice.emergencyCancelled,
    });
    confirmation.current = flow;
    void flow.result.then(() => speechService.abort()); // hết giờ khi mic còn mở → đóng mic
    while (!flow.settled && !cancelled.current) {
      const outcome = await speechService.listenOnce().catch((e: unknown) => {
        logger.warn('Confirmation listen failed', e);
        return null;
      });
      logger.debug('Confirmation heard', {
        alternatives: outcome?.alternatives,
        echo: outcome?.discardedAsEcho,
      });
      if (!outcome) flow.cancel();
      else flow.hear(outcome.alternatives);
    }
    confirmation.current = null;
    return (await flow.result).status === 'Confirmed';
  }, []);

  const start = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    cancelled.current = false;
    const lastAnnouncement = ttsService.getLastText();
    setHeard(null);
    setPhase('listening');
    void HapticService.tap();
    try {
      if (!(await ensureMicPermission())) return;
      if (await AccessibilityInfo.isScreenReaderEnabled()) await delay(SCREEN_READER_SETTLE_MS);
      if (cancelled.current) return;

      const outcome = await speechService.listenOnce();
      if (cancelled.current) return;
      setHeard(outcome.alternatives[0]?.transcript ?? null);
      const command = matchIntent(outcome.alternatives);
      // debug bị tắt ở production — transcript là dữ liệu nhạy cảm (§16.8)
      logger.debug('Voice command', {
        engine: outcome.engine,
        heard: outcome.alternatives[0]?.transcript,
        intent: command?.intent ?? null,
        ms: outcome.processingTimeMs,
        echo: outcome.discardedAsEcho,
      });
      if (!command) {
        say(Strings.voice.notUnderstood);
        return;
      }
      if (command.requiresConfirmation) {
        setPhase('confirming');
        if (!(await confirm())) return;
      }
      runVoiceIntent(command.intent, {
        say,
        navigationActive: navRef.current.active,
        startNavigation: navRef.current.start,
        stopNavigation: navRef.current.stop,
        setDetectionMode,
        speechRate: ttsService.getSettings().rate,
        setSpeechRate: (rate) => ttsService.updateSettings({ rate }),
        lastAnnouncement,
      });
    } catch (e) {
      // Offline không nhận dạng được: SpeechService đã hướng dẫn dùng nút
      if (!(e instanceof OfflineSpeechUnavailableError)) {
        logger.warn('Voice command failed', e);
        say(Strings.errors.unavailable, TtsPriority.SYSTEM);
      }
    } finally {
      busy.current = false;
      setPhase('idle');
    }
  }, [confirm, setDetectionMode]);

  const cancel = useCallback(() => {
    if (!busy.current) return;
    cancelled.current = true;
    confirmation.current?.cancel(); // tự báo "đã hủy gọi khẩn cấp"
    if (!confirmation.current) say(Strings.voice.cancelled);
    speechService.abort();
  }, []);

  // Rời màn hình khi đang nghe → đóng mic
  useEffect(() => () => speechService.abort(), []);

  return { phase, heard, start, cancel };
}
