import type {
  EmergencyContact,
  EmergencyEvent,
  EmergencyEventPayload,
} from '@/api/endpoints/emergency';
import type { DetectionMethod } from '@/constants/enums';
import { Strings } from '@/constants/strings.vi';
import { logger } from '@/utils/logger';

import { planEmergencyCall, type CallPlan } from './callPlan';

export interface SosDeps {
  isOnline(): boolean;
  position(): Promise<{ latitude: number; longitude: number } | null>;
  createEvent(payload: EmergencyEventPayload): Promise<EmergencyEvent>;
  /** Hàng đợi offline — emergency KHÔNG BAO GIỜ bị bỏ (§16.19). */
  enqueue(payload: EmergencyEventPayload): Promise<void>;
  contacts(): Promise<EmergencyContact[]>;
  /** Đọc (EMERGENCY) và chờ đọc xong trước khi rời app sang cuộc gọi. */
  announce(text: string): Promise<void>;
  call(plan: CallPlan): Promise<void>;
  now(): number;
}

export interface SosResult {
  /** Server đã nhận ngay; false = đang chờ trong hàng đợi offline. */
  sent: boolean;
  plan: CallPlan;
}

export function describeCallPlan(plan: CallPlan): string {
  switch (plan.kind) {
    case 'call':
      return Strings.emergency.calling(plan.contact.contactName);
    case 'dial':
      return Strings.emergency.dialing(plan.contact.contactName, plan.number);
    case 'zalo':
      return Strings.emergency.zalo(plan.contact.contactName);
    case 'none':
      return Strings.emergency.noContact;
  }
}

/**
 * SOS thủ công / giọng nói / cử chỉ (§9.7) — gọi SAU khi đã xác nhận (BR-14). Gửi event (server set
 * `Sent` ngay); lỗi mạng → vào hàng đợi, tự gửi lại. Sau đó gọi người liên hệ theo `priorityOrder`,
 * kể cả khi chưa gửi được event.
 */
export async function sendSos(method: DetectionMethod, deps: SosDeps): Promise<SosResult> {
  const detectedAt = new Date(deps.now()).toISOString();
  const position = await deps.position();
  const payload: EmergencyEventPayload = {
    detectionMethod: method,
    detectedAt,
    latitude: position?.latitude ?? null,
    longitude: position?.longitude ?? null,
  };

  let sent = false;
  if (deps.isOnline()) {
    try {
      await deps.createEvent(payload);
      sent = true;
    } catch (e) {
      logger.warn('Send SOS failed, queued', e);
    }
  }
  if (!sent) {
    await deps.enqueue(payload).catch((e: unknown) => logger.error('Queue SOS failed', e));
  }

  const plan = planEmergencyCall(await deps.contacts().catch(() => []));
  await deps.announce(
    `${sent ? Strings.emergency.sent : Strings.emergency.queued} ${describeCallPlan(plan)}`,
  );
  if (plan.kind !== 'none') {
    await deps.call(plan).catch((e: unknown) => logger.warn('Emergency call failed', e));
  }
  return { sent, plan };
}
