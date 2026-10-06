import { ApiError } from '@/api/client';
import type { EmergencyContact, EmergencyEventPayload } from '@/api/endpoints/emergency';
import { BusinessRules } from '@/constants/businessRules';
import { Strings } from '@/constants/strings.vi';
import { logger } from '@/utils/logger';

import { planEmergencyCall, type CallPlan } from './callPlan';
import type { FallEvent } from './fallDetector';
import { describeCallPlan } from './sos';

export type FallAlertPhase = 'idle' | 'countdown' | 'cancelled' | 'sent';

export interface FallAlertState {
  phase: FallAlertPhase;
  /** Giây còn lại của grace period (chỉ là UI — server là nguồn sự thật). */
  remaining: number;
}

export interface FallAlertDeps {
  isOnline(): boolean;
  position(): Promise<{ latitude: number; longitude: number } | null>;
  createEvent(payload: EmergencyEventPayload): Promise<{ id: string }>;
  dismissEvent(id: string): Promise<void>;
  /** Hàng đợi offline — emergency không bao giờ bị bỏ. */
  enqueue(payload: EmergencyEventPayload): Promise<void>;
  contacts(): Promise<EmergencyContact[]>;
  call(plan: CallPlan): Promise<void>;
  /** TTS ưu tiên EMERGENCY. */
  say(text: string): void;
  tick(): void;
  sentHaptic(): void;
  setTimer(fn: () => void, ms: number): unknown;
  now(): number;
  clearTimer(handle: unknown): void;
}

/**
 * Giây đọc to khi đếm ngược; các giây khác chỉ rung. Đọc ít để mic có khoảng lặng nghe "tôi ổn" —
 * mọi câu nghe được lúc TTS đang đọc đều bị bỏ (chống tự nghe).
 */
const SPOKEN_SECONDS = new Set([10, 5]);

/**
 * Cảnh báo té ngã `AccelerometerCamera` (BR-27, BR-28, §9.7). Online: tạo event ngay (server đặt
 * `Detected`, grace = `detectedAt` + 15 s, tự gửi Caregiver khi hết hạn); hủy → `dismiss`. Offline: đợi
 * hết 15 s, không bị hủy → đưa event vào hàng đợi (server gửi ngay vì grace đã qua) + tự gọi người thân.
 *
 * `detectedAt` = lúc đủ HAI tín hiệu (bắt đầu đếm ngược), không phải lúc va chạm: va chạm sớm hơn ≥ 5 s
 * (chờ camera đứng yên) → server sẽ hết grace trước khi đồng hồ trên máy về 0. Lúc va chạm vẫn gửi
 * trong `accelerometerData`.
 *
 * Mỗi lần cảnh báo có một `generation`: hủy / reset tăng số này → mọi bước `await` của lần cũ (lấy
 * GPS, tạo event, gửi hàng đợi) dừng lại, không tạo event sau khi người dùng đã hủy.
 */
export function createFallAlert(deps: FallAlertDeps, onChange: (s: FallAlertState) => void) {
  let state: FallAlertState = { phase: 'idle', remaining: 0 };
  let timer: unknown = null;
  let eventId: Promise<string | null> = Promise.resolve(null);
  let payload: EmergencyEventPayload | null = null;
  let generation = 0;

  const set = (next: FallAlertState) => {
    state = next;
    onChange(state);
  };

  const finish = async () => {
    const gen = generation;
    timer = null;
    set({ phase: 'sent', remaining: 0 });
    deps.sentHaptic();
    const id = await eventId;
    if (gen !== generation) return; // đã reset cho lần té ngã khác
    if (id) {
      deps.say(Strings.fall.sent);
      return;
    }
    // Offline / tạo event lỗi: gửi qua hàng đợi + tự gọi người liên hệ ưu tiên (§9.7)
    if (payload) {
      await deps.enqueue(payload).catch((e: unknown) => logger.error('Queue fall event failed', e));
    }
    const plan = planEmergencyCall(await deps.contacts().catch(() => []));
    deps.say(`${Strings.fall.queued} ${describeCallPlan(plan)}`);
    if (plan.kind !== 'none') {
      await deps.call(plan).catch((e: unknown) => logger.warn('Fall call failed', e));
    }
  };

  const countDown = () => {
    if (state.phase !== 'countdown') return;
    const remaining = state.remaining - 1;
    if (remaining <= 0) {
      void finish();
      return;
    }
    set({ phase: 'countdown', remaining });
    deps.tick();
    if (SPOKEN_SECONDS.has(remaining)) deps.say(String(remaining));
    timer = deps.setTimer(countDown, 1000);
  };

  return {
    getState: () => state,

    async start(fall: FallEvent): Promise<void> {
      if (state.phase === 'countdown') return;
      const gen = ++generation;
      const detectedAt = new Date(deps.now()).toISOString();
      set({ phase: 'countdown', remaining: BusinessRules.FALL_GRACE_PERIOD_SECONDS });
      deps.tick();
      deps.say(Strings.fall.detected);
      timer = deps.setTimer(countDown, 1000);

      const position = await deps.position();
      // Người dùng hủy (hoặc reset) trong lúc lấy GPS → KHÔNG tạo event nữa
      if (gen !== generation) return;
      payload = {
        detectionMethod: 'AccelerometerCamera',
        detectedAt,
        accelerometerData: fall.accelerometerData,
        latitude: position?.latitude ?? null,
        longitude: position?.longitude ?? null,
      };
      if (deps.isOnline()) {
        const p = payload;
        eventId = deps
          .createEvent(p)
          .then((e) => e.id)
          .catch((e: unknown) => {
            logger.warn('Create fall event failed, will queue', e);
            return null;
          });
      }
    },

    /** Chạm màn hình / nói "tôi ổn". */
    async cancel(): Promise<void> {
      if (state.phase !== 'countdown') return;
      if (timer !== null) deps.clearTimer(timer);
      timer = null;
      const gen = ++generation; // chặn start() đang chờ GPS tạo event
      set({ phase: 'cancelled', remaining: 0 });
      const id = await eventId;
      if (gen !== generation) return;
      if (!id) {
        deps.say(Strings.fall.cancelled); // chưa gửi gì lên server
        return;
      }
      try {
        await deps.dismissEvent(id);
        deps.say(Strings.fall.cancelled);
      } catch (e) {
        // 422 = server đã hết grace và gửi đi; lỗi mạng → không chắc đã hủy kịp
        deps.say(
          e instanceof ApiError && e.status === 422
            ? Strings.fall.alreadySent
            : Strings.fall.cancelUncertain,
        );
      }
    },

    reset(): void {
      generation++;
      if (timer !== null) deps.clearTimer(timer);
      timer = null;
      eventId = Promise.resolve(null);
      payload = null;
      set({ phase: 'idle', remaining: 0 });
    },
  };
}
