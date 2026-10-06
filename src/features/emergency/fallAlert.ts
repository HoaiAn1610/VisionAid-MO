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
  clearTimer(handle: unknown): void;
}

/** Giây đọc to khi đếm ngược; các giây khác chỉ rung để mic còn khoảng lặng nghe "tôi ổn". */
const SPOKEN_SECONDS = new Set([10, 5, 4, 3, 2, 1]);

/**
 * Cảnh báo té ngã `AccelerometerCamera` (BR-27, BR-28, §9.7). Online: tạo event ngay (server đặt
 * `Detected`, grace = va chạm + 15 s, tự gửi Caregiver khi hết hạn); hủy → `dismiss`. Offline: đợi hết
 * 15 s, không bị hủy → đưa event vào hàng đợi (server gửi ngay vì grace đã qua) + tự gọi người thân.
 */
export function createFallAlert(deps: FallAlertDeps, onChange: (s: FallAlertState) => void) {
  let state: FallAlertState = { phase: 'idle', remaining: 0 };
  let timer: unknown = null;
  let eventId: Promise<string | null> = Promise.resolve(null);
  let payload: EmergencyEventPayload | null = null;

  const set = (next: FallAlertState) => {
    state = next;
    onChange(state);
  };

  const finish = async () => {
    timer = null;
    set({ phase: 'sent', remaining: 0 });
    deps.sentHaptic();
    const id = await eventId;
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
      set({ phase: 'countdown', remaining: BusinessRules.FALL_GRACE_PERIOD_SECONDS });
      deps.tick();
      deps.say(Strings.fall.detected);
      timer = deps.setTimer(countDown, 1000);

      const position = await deps.position();
      payload = {
        detectionMethod: 'AccelerometerCamera',
        detectedAt: new Date(fall.impactAt).toISOString(),
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
      set({ phase: 'cancelled', remaining: 0 });
      const id = await eventId;
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
      if (timer !== null) deps.clearTimer(timer);
      timer = null;
      eventId = Promise.resolve(null);
      payload = null;
      set({ phase: 'idle', remaining: 0 });
    },
  };
}
