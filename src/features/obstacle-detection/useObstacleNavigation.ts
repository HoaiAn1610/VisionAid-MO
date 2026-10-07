import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Accelerometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';

import { Strings } from '@/constants/strings.vi';
import { HapticService } from '@/services/haptics/HapticService';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { isNavigationAllowed } from '@/features/auth/licenseNotice';
import { fallAlert, isFallAlertActive } from '@/features/emergency/fallAlertService';
import { createFallDetector } from '@/features/emergency/fallDetector';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { logger } from '@/utils/logger';

import {
  endNavigationSession,
  recordDetectionEvent,
  startNavigationSession,
} from './navigationSession';
import {
  confirmAcrossFrames,
  selectPriorityObstacle,
  toTtsRequest,
  type PriorityObstacle,
} from './obstaclePolicy';
import { TARGET_INFERENCE_FPS, useObstacleDetector, type FrameResult } from './useObstacleDetector';

const MODEL = require('../../../assets/models/yolov8n_float16.tflite'); // eslint-disable-line @typescript-eslint/no-require-imports -- asset .tflite phải require() để Metro bundle
const PREFERRED_DELEGATES = ['android-gpu' as const];
const KEEP_AWAKE_TAG = 'navigation-session';
/** Không có cảnh báo mới trong khoảng này → dòng trạng thái về "chưa phát hiện" (tránh hiển thị tin cũ). */
const STATUS_STALE_MS = 4000;
/** ~50 Hz: đủ bắt pha rơi tự do (~0,3 s) và đỉnh va chạm. */
const ACCEL_INTERVAL_MS = 20;
/** Vật phải xuất hiện ở 2 frame liên tiếp mới báo (khoảng 2 chu kỳ inference, cho phép trễ nhịp). */
const CONFIRM_WINDOW_MS = 2000 / TARGET_INFERENCE_FPS;

const say = (text: string, priority = TtsPriority.SYSTEM) => ttsService.enqueue({ text, priority });

/**
 * Phiên dẫn đường (UC-21/22): bật camera + YOLO, mỗi chu kỳ announce đúng MỘT vật ưu tiên (BR-12),
 * giữ màn hình sáng, ghi session + detection event (đồng bộ lên server khi có mạng).
 */
export function useObstacleNavigation() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const mode = useSettingsStore((s) => s.detectionMode);
  const [active, setActive] = useState(false);
  const [lastAnnouncement, setLastAnnouncement] = useState<string | null>(null);
  const awaitingModel = useRef(false);
  const sessionId = useRef<string | null>(null);
  const starting = useRef(false);
  const wantActive = useRef(false);
  const staleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeen = useRef(new Map<string, number>());
  // Phát hiện té ngã chỉ chạy trong phiên dẫn đường (cần camera, BR-26)
  const [fallDetectorInstance] = useState(() =>
    createFallDetector((event) => fallAlert.trigger(event)),
  );
  const fallDetector = useRef(fallDetectorInstance);

  const onResult = useCallback(
    (r: FrameResult) => {
      fallDetector.current.onFrame(r.signature, Date.now());
      if (isFallAlertActive()) return; // đang đếm ngược té ngã → im lặng để nghe "tôi ổn"
      if (r.detections.length === 0) return;
      const confirmed = confirmAcrossFrames(
        r.detections,
        lastSeen.current,
        Date.now(),
        CONFIRM_WINDOW_MS,
      );
      const pick = selectPriorityObstacle(confirmed, mode);
      if (!pick) return;
      const request = toTtsRequest(pick);
      if (!ttsService.enqueue(request)) return; // cooldown / trùng → không phải một lần cảnh báo
      setLastAnnouncement(request.text);
      if (staleTimer.current) clearTimeout(staleTimer.current);
      staleTimer.current = setTimeout(() => setLastAnnouncement(null), STATUS_STALE_MS);
      if (sessionId.current) logAlert(sessionId.current, pick, r.inferenceMs);
    },
    [mode],
  );

  const detector = useObstacleDetector(MODEL, PREFERRED_DELEGATES, { onResult });

  // GPU lỗi → hook tự nạp lại trên CPU; chỉ coi là hỏng khi CPU cũng thất bại
  const modelFatal = detector.modelState === 'error' && detector.usingCpuFallback;
  const sessionActive = active && !modelFatal;
  useEffect(() => {
    if (!active || !modelFatal) return;
    say(Strings.navigation.modelFailed);
    wantActive.current = false;
    closeSession(sessionId);
  }, [active, modelFatal]);

  useEffect(() => {
    if (!sessionActive) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch((e: unknown) =>
      logger.warn('Keep awake failed', e),
    );
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [sessionActive]);

  // Gia tốc kế cho phát hiện té ngã — chỉ trong phiên, dừng khi kết thúc (§16.7)
  useEffect(() => {
    if (!sessionActive) return;
    const detector = fallDetector.current;
    detector.reset();
    Accelerometer.setUpdateInterval(ACCEL_INTERVAL_MS);
    const sub = Accelerometer.addListener(({ x, y, z }) =>
      detector.onAccel({ x, y, z, t: Date.now() }),
    );
    return () => sub.remove();
  }, [sessionActive]);

  // Camera tắt khi app xuống nền (DetectionCamera) → phải báo, kẻo người dùng tưởng vẫn được cảnh báo
  useEffect(() => {
    if (!sessionActive) return;
    let inBackground = false;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && !inBackground) {
        inBackground = true;
        say(Strings.navigation.paused);
      } else if (state === 'active' && inBackground) {
        inBackground = false;
        say(Strings.navigation.resumed);
      }
    });
    return () => sub.remove();
  }, [sessionActive]);

  // Bấm bắt đầu lúc model còn đang nạp → báo "bắt đầu" ngay khi sẵn sàng
  useEffect(() => {
    if (active && awaitingModel.current && detector.modelState === 'loaded') {
      awaitingModel.current = false;
      say(Strings.navigation.started);
    }
  }, [active, detector.modelState]);

  const start = useCallback(async () => {
    // Chạm đúp (TalkBack) / bấm liên tiếp → chỉ một phiên
    if (starting.current || wantActive.current) return;
    // Update Report §3.4: chưa có gói → không dẫn đường (SOS vẫn chạy ở màn khẩn cấp)
    if (!isNavigationAllowed(useAuthStore.getState().user?.licenseStatus)) {
      say(Strings.license.navigationBlocked);
      return;
    }
    starting.current = true;
    try {
      if (!hasPermission) {
        // Giải thích bằng TTS trước khi hiện hộp thoại hệ thống (CLAUDE.md §14)
        say(Strings.navigation.cameraExplain, TtsPriority.FEEDBACK);
        if (!(await requestPermission())) {
          say(Strings.navigation.cameraDenied);
          await Linking.openSettings().catch((e: unknown) =>
            logger.warn('Open settings failed', e),
          );
          return;
        }
      }
      wantActive.current = true;
      setLastAnnouncement(null);
      setActive(true);
      void HapticService.success();
      const ready = detector.modelState === 'loaded';
      awaitingModel.current = !ready;
      say(ready ? Strings.navigation.started : Strings.navigation.modelLoading);

      const id = await startNavigationSession(mode).catch((e: unknown) => {
        logger.warn('Start session failed', e);
        return null; // vẫn dẫn đường được, chỉ không ghi log
      });
      // Người dùng đã bấm Dừng trong lúc phiên đang được tạo → đóng ngay, không bỏ rơi phiên
      if (!wantActive.current) {
        if (id)
          endNavigationSession(id).catch((e: unknown) => logger.warn('End session failed', e));
        return;
      }
      sessionId.current = id;
    } finally {
      starting.current = false;
    }
  }, [hasPermission, requestPermission, detector.modelState, mode]);

  const stop = useCallback(() => {
    wantActive.current = false;
    setActive(false);
    closeSession(sessionId);
    void HapticService.tap();
    say(Strings.navigation.stopped);
  }, []);

  // Rời màn hình khi phiên còn chạy (ví dụ đăng xuất) → vẫn đóng phiên
  useEffect(
    () => () => {
      closeSession(sessionId);
      if (staleTimer.current) clearTimeout(staleTimer.current);
    },
    [],
  );

  return {
    active: sessionActive,
    start,
    stop,
    lastAnnouncement,
    frameProcessor: detector.frameProcessor,
    modelState: detector.modelState,
  };
}

function closeSession(ref: { current: string | null }): void {
  const id = ref.current;
  ref.current = null;
  if (id) endNavigationSession(id).catch((e: unknown) => logger.warn('End session failed', e));
}

/** Ghi một lần cảnh báo (alertIssued) — box chuẩn hóa 0–1, rút gọn cho vừa giới hạn 500 ký tự. */
function logAlert(localId: string, pick: PriorityObstacle, inferenceMs: number): void {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  recordDetectionEvent(localId, {
    objectClass: pick.label,
    confidenceScore: r(pick.score),
    distanceRange: pick.distance,
    boundingBox: JSON.stringify({ x: r(pick.x), y: r(pick.y), w: r(pick.w), h: r(pick.h) }),
    alertIssued: true,
    inferenceTimeMs: inferenceMs > 0 ? Math.round(inferenceMs) : undefined,
    detectedAt: new Date().toISOString(),
  }).catch((e: unknown) => logger.warn('Record detection event failed', e));
}
