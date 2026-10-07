import { useCallback, useEffect, useRef, useState } from 'react';
import type { Camera } from 'react-native-vision-camera';

import type { UploadImage } from '@/api/endpoints/ocr';
import { useVoice } from '@/features/voice-commands/VoiceProvider';
import { useCameraAccess } from '@/hooks/useCameraAccess';
import { captureJpeg, deletePhoto } from '@/services/camera/photoCapture';
import { HapticService } from '@/services/haptics/HapticService';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { logger } from '@/utils/logger';

export type CapturePhase = 'aiming' | 'busy' | 'result';

export interface CaptureOptions {
  /** Route của màn hình (lệnh giọng nói mở lại chính màn này → chụp lại). */
  route: '/read-text' | '/face';
  /** Hướng dẫn ngắm, đọc khi mở màn hình và khi chụp lại. */
  aim: string;
  /** Cạnh dài tối đa của ảnh gửi đi (§16.13). */
  maxSide: number;
  /** Trả câu TTS nếu không được chụp (ví dụ cần mạng); `null` → chụp. */
  precheck?: () => string | null;
  /** Xử lý ảnh → câu TTS kết quả. */
  process(image: UploadImage): Promise<string>;
  describeError(error: unknown): string;
}

export const say = (text: string, priority = TtsPriority.FEEDBACK) =>
  ttsService.enqueue({ text, priority });

/**
 * Chụp một ảnh → xử lý → đọc kết quả (đọc chữ, nhận diện người quen). Ảnh tạm LUÔN bị xóa trong
 * `finally`, kể cả khi lỗi (BR-22).
 */
export function useCaptureAndSpeak(options: CaptureOptions) {
  const hasPermission = useCameraAccess(options.aim);
  const { listen, registerScreenAction } = useVoice();
  const camera = useRef<Camera>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const opts = useRef(options);
  const [phase, setPhase] = useState<CapturePhase>('aiming');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    opts.current = options;
  });
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const capture = useCallback(async () => {
    const cam = camera.current;
    if (busy.current || !cam) return;
    const { precheck, process, describeError, maxSide } = opts.current;
    const blocked = precheck?.();
    if (blocked) {
      say(blocked, TtsPriority.SYSTEM);
      return;
    }
    busy.current = true;
    setPhase('busy');
    void HapticService.tap();
    let image: UploadImage | null = null;
    let spoken: string;
    try {
      image = await captureJpeg(cam, maxSide);
      spoken = await process(image);
    } catch (e) {
      logger.warn('Capture failed', e);
      spoken = describeError(e);
    } finally {
      if (image) deletePhoto(image.uri);
      busy.current = false;
    }
    if (!mounted.current) return; // đã rời màn hình → không đọc kết quả muộn
    setMessage(spoken);
    setPhase('result');
    say(spoken);
    listen('follow-up'); // nghe lệnh tiếp theo sau khi đọc xong kết quả (mic chờ TTS im)
  }, [listen]);

  const again = useCallback(() => {
    setMessage(null);
    setPhase('aiming');
    say(opts.current.aim);
  }, []);

  const { route } = options;
  useEffect(() => {
    registerScreenAction(route, again);
    return () => registerScreenAction(route, null);
  }, [registerScreenAction, route, again]);

  return { hasPermission, camera, phase, message, capture, again };
}
