import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useCameraPermission, useCodeScanner, type Code } from 'react-native-vision-camera';

import type { QrScanLog } from '@/api/endpoints/ocr';
import type { TriggerMethod } from '@/constants/enums';
import { Strings } from '@/constants/strings.vi';
import { syncOfflineNow } from '@/features/sync/offlineSync';
import { confirmByVoice, type VoiceConfirmation } from '@/features/voice-commands/confirmByVoice';
import { HapticService } from '@/services/haptics/HapticService';
import { speechService } from '@/services/speech/SpeechService';
import { enqueue } from '@/services/storage/offlineQueue';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { logger } from '@/utils/logger';

import { describeQr, type QrInfo } from './qrContent';

export type QrPhase = 'scanning' | 'result';

const say = (text: string, priority = TtsPriority.FEEDBACK) =>
  ttsService.enqueue({ text, priority });

/** QR đọc được cả khi offline → log vào hàng đợi, gửi khi có mạng (§9.3, §13). */
function recordQrScan(log: QrScanLog): void {
  enqueue('qr', log)
    .then(syncOfflineNow)
    .catch((e: unknown) => logger.warn('Record QR scan failed', e));
}

/**
 * Quét QR on-device (FE-07, §9.3): đọc được mã → rung + đọc nội dung; URL → đọc tên miền và hỏi
 * có mở không (nói "đồng ý" hoặc chạm nút) — KHÔNG bao giờ tự mở.
 */
export function useQrScanner(trigger: TriggerMethod) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [phase, setPhase] = useState<QrPhase>('scanning');
  const [info, setInfo] = useState<QrInfo | null>(null);
  const handled = useRef(false);
  const confirmation = useRef<VoiceConfirmation | null>(null);

  // Xin quyền camera: giải thích bằng TTS trước hộp thoại hệ thống (§14)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!hasPermission) {
        say(Strings.navigation.cameraExplain);
        if (!(await requestPermission())) {
          if (cancelled) return;
          say(Strings.navigation.cameraDenied, TtsPriority.SYSTEM);
          await Linking.openSettings().catch((e: unknown) =>
            logger.warn('Open settings failed', e),
          );
          return;
        }
      }
      if (!cancelled) say(Strings.qr.aim);
    })();
    return () => {
      cancelled = true;
    };
    // Chỉ chạy khi mở màn hình — hasPermission đổi sau khi cấp quyền không cần đọc lại hướng dẫn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openUrl = useCallback((url: string) => {
    Linking.openURL(url).catch((e: unknown) => {
      logger.warn('Open QR URL failed', e);
      say(Strings.errors.unavailable, TtsPriority.SYSTEM);
    });
  }, []);

  const askToOpen = useCallback(
    async (qr: QrInfo) => {
      if (!qr.url || !qr.domain) return;
      const c = confirmByVoice(Strings.qr.askOpen(qr.domain), Strings.qr.notOpened);
      confirmation.current = c;
      const confirmedAt = await c.result;
      if (confirmation.current === c) confirmation.current = null;
      if (confirmedAt) openUrl(qr.url);
    },
    [openUrl],
  );

  const onCodeScanned = useCallback(
    (codes: Code[]) => {
      const value = codes.find((c) => c.value)?.value;
      if (handled.current || !value) return;
      handled.current = true; // camera bắn nhiều lần cho cùng một mã → chỉ xử lý lần đầu
      const qr = describeQr(value);
      setInfo(qr);
      setPhase('result');
      void HapticService.success();
      say(qr.speech);
      recordQrScan({
        qrContent: value,
        qrType: qr.kind,
        isUrl: qr.url !== null,
        urlDomain: qr.domain,
        ocrEngine: 'MLKit',
        triggerMethod: trigger,
        resultStatus: 'Success',
        ttsAnnounced: true,
        scannedAt: new Date().toISOString(),
      });
      void askToOpen(qr);
    },
    [askToOpen, trigger],
  );

  const codeScanner = useCodeScanner({ codeTypes: ['qr'], onCodeScanned });

  /** Chạm "Mở trang": dừng câu hỏi bằng giọng nói (im lặng) rồi mở luôn. */
  const openLink = useCallback(() => {
    if (!info?.url) return;
    confirmation.current?.cancel(true);
    confirmation.current = null;
    openUrl(info.url);
  }, [info, openUrl]);

  const scanAgain = useCallback(() => {
    confirmation.current?.cancel(true);
    confirmation.current = null;
    handled.current = false;
    setInfo(null);
    setPhase('scanning');
    say(Strings.qr.aim);
  }, []);

  // Rời màn hình khi đang hỏi → dừng hỏi, đóng mic
  useEffect(
    () => () => {
      confirmation.current?.cancel(true);
      speechService.abort();
    },
    [],
  );

  return { hasPermission, phase, info, codeScanner, openLink, scanAgain };
}
