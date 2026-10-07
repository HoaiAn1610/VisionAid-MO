import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Linking } from 'react-native';

import type { CommandStatus } from '@/constants/enums';
import { Strings } from '@/constants/strings.vi';
import { HapticService } from '@/services/haptics/HapticService';
import { OfflineSpeechUnavailableError, speechService } from '@/services/speech/SpeechService';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { useSettingsStore } from '@/stores/settingsStore';

import { getMediaVolume, setMediaVolume } from '../../../modules/volume-key';
import { logger } from '@/utils/logger';

import { confirmByVoice, type VoiceConfirmation } from './confirmByVoice';
import { matchIntent } from './intentMatcher';
import { runVoiceIntent } from './runVoiceIntent';
import { recordVoiceCommand, toVoiceLog } from './voiceLog';

export type VoicePhase = 'idle' | 'listening' | 'confirming';

/**
 * `manual`: người dùng chủ động (nút / phím âm lượng). `launch`: tự nghe khi mở app.
 * `follow-up`: tự nghe sau một kết quả. Hai chế độ tự động không nghe thấy gì thì không báo
 * "chưa hiểu" (người dùng có thể không định nói); `launch` nhắc cách gọi lại.
 */
export type ListenMode = 'manual' | 'launch' | 'follow-up';

interface NavigationControls {
  active: boolean;
  start(): void;
  stop(): void;
  openQrScanner(): void;
  openTextReader(): void;
  openFaceRecognizer(): void;
  openLocation(): void;
  openEmergency(): void;
  dismissFall(): boolean;
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
  const confirmation = useRef<VoiceConfirmation | null>(null);
  const setDetectionMode = useSettingsStore((s) => s.setDetectionMode);
  const navRef = useRef(navigation);
  useEffect(() => {
    navRef.current = navigation;
  }, [navigation]);

  /** Hỏi xác nhận lệnh nguy hiểm, nghe tới khi có câu trả lời hoặc hết 10 s (BR-14). */
  const confirm = useCallback(async (): Promise<Date | null> => {
    const c = confirmByVoice(Strings.voice.confirmEmergency, Strings.voice.emergencyCancelled);
    confirmation.current = c;
    const confirmedAt = await c.result;
    confirmation.current = null;
    return confirmedAt;
  }, []);

  const start = useCallback(
    async (mode: ListenMode = 'manual') => {
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
        const executedAt = new Date();
        setHeard(outcome.alternatives[0]?.transcript ?? null);
        if (mode !== 'manual' && outcome.alternatives.length === 0) {
          if (mode === 'launch') say(Strings.voice.wakeHint);
          return;
        }
        const command = matchIntent(outcome.alternatives);
        // Lượt im lặng / tiếng của chính TTS → không ghi log (tránh log rác)
        const log = (status: CommandStatus, confirmedAt?: Date) => {
          if (outcome.alternatives.length === 0) return;
          recordVoiceCommand(toVoiceLog({ outcome, command, status, executedAt, confirmedAt }));
        };
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
          return log('Unrecognized');
        }
        let confirmedAt: Date | undefined;
        if (command.requiresConfirmation) {
          setPhase('confirming');
          confirmedAt = (await confirm()) ?? undefined;
          if (!confirmedAt) return log('Cancelled');
        }
        let handled = false;
        try {
          handled = runVoiceIntent(command.intent, {
            say,
            navigationActive: navRef.current.active,
            startNavigation: navRef.current.start,
            stopNavigation: navRef.current.stop,
            openQrScanner: navRef.current.openQrScanner,
            openTextReader: navRef.current.openTextReader,
            openFaceRecognizer: navRef.current.openFaceRecognizer,
            openLocation: navRef.current.openLocation,
            openEmergency: navRef.current.openEmergency,
            dismissFall: navRef.current.dismissFall,
            setDetectionMode,
            speechRate: ttsService.getSettings().rate,
            setSpeechRate: (rate) => ttsService.updateSettings({ rate }),
            lastAnnouncement,
            mediaVolume: getMediaVolume(),
            setMediaVolume: (volume) => void setMediaVolume(volume),
          });
        } finally {
          log(handled ? (confirmedAt ? 'Confirmed' : 'Success') : 'Failed', confirmedAt);
        }
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
    },
    [confirm, setDetectionMode],
  );

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
