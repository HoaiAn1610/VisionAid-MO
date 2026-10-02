import { useEffect } from 'react';
import { Linking } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';

import { Strings } from '@/constants/strings.vi';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { logger } from '@/utils/logger';

/**
 * Xin quyền camera khi mở màn hình: giải thích bằng TTS trước hộp thoại hệ thống (§14), bị từ chối
 * → mở cài đặt. Có quyền → đọc hướng dẫn ngắm `aim`.
 */
export function useCameraAccess(aim: string): boolean {
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    let cancelled = false;
    const say = (text: string, priority = TtsPriority.FEEDBACK) =>
      ttsService.enqueue({ text, priority });
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
      if (!cancelled) say(aim);
    })();
    return () => {
      cancelled = true;
    };
    // Chỉ chạy khi mở màn hình — hasPermission đổi sau khi cấp quyền không cần đọc lại hướng dẫn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return hasPermission;
}
