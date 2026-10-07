import type { EmergencyContact } from '@/api/endpoints/emergency';

/** Số khẩn cấp Việt Nam: Android không cho ứng dụng tự quay các số này (chỉ mở được trình quay số). */
const EMERGENCY_NUMBERS = new Set(['112', '113', '114', '115']);

export type CallPlan =
  /** Tự quay số (TelecomManager.placeCall). */
  | { kind: 'call'; contact: EmergencyContact; number: string }
  /** Mở trình quay số đã điền sẵn — người dùng phải chạm nút gọi (số khẩn cấp). */
  | { kind: 'dial'; contact: EmergencyContact; number: string }
  /** Mở Zalo bằng deep link (contact chỉ có Zalo). */
  | { kind: 'zalo'; contact: EmergencyContact; url: string }
  | { kind: 'none' };

const digits = (n: string) => n.replace(/[^\d+]/g, '');

export const isEmergencyNumber = (number: string) => EMERGENCY_NUMBERS.has(digits(number));

/**
 * Chọn MỘT cách liên lạc sau khi gửi SOS (§9.7). Theo `priorityOrder`, ưu tiên người tự quay số
 * được (người thân, hotline trung tâm); số khẩn cấp 112/115 chỉ mở trình quay số nên xếp sau;
 * contact chỉ có Zalo dùng khi không có số điện thoại nào.
 */
export function planEmergencyCall(contacts: readonly EmergencyContact[]): CallPlan {
  const sorted = [...contacts].sort((a, b) => a.priorityOrder - b.priorityOrder);
  const phones = sorted.filter(
    (c) => c.contactType !== 'Zalo' && c.phoneNumber && digits(c.phoneNumber),
  );
  const direct = phones.find((c) => !isEmergencyNumber(c.phoneNumber!));
  if (direct) return { kind: 'call', contact: direct, number: digits(direct.phoneNumber!) };
  const hotline = phones[0];
  if (hotline) return { kind: 'dial', contact: hotline, number: digits(hotline.phoneNumber!) };
  const zalo = sorted.find((c) => c.contactType !== 'Phone' && c.zaloDeepLink);
  if (zalo) return { kind: 'zalo', contact: zalo, url: zalo.zaloDeepLink! };
  return { kind: 'none' };
}
