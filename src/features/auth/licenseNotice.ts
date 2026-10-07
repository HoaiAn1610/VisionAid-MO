import type { LicenseEvent } from '@/api/client';
import { BusinessRules } from '@/constants/businessRules';
import { Strings } from '@/constants/strings.vi';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Báo trước bằng giọng nói từ `licenseStatus` của /users/me (backend 8f2641a), thay vì chỉ biết khi
 * gặp 402. Khớp chính sách (Update Report §3.4) và LicenseValidationMiddleware: hết hạn ≤ 3 ngày vẫn
 * dùng được; dùng thử luôn báo số ngày còn lại.
 */
export function licenseEventFor(
  status: string | null | undefined,
  expiresAt: string | null | undefined,
  now: number = Date.now(),
): LicenseEvent | null {
  const daysLeft = expiresAt ? Math.ceil((Date.parse(expiresAt) - now) / DAY_MS) : null;
  switch (status) {
    case 'None':
      return { kind: 'blocked' };
    case 'Expired':
      return daysLeft !== null && daysLeft > -BusinessRules.LICENSE_GRACE_PERIOD_DAYS
        ? { kind: 'expiring', daysLeft: 0 }
        : { kind: 'blocked' };
    case 'Trial':
      return daysLeft !== null ? { kind: 'trial', daysLeft: Math.max(0, daysLeft) } : null;
    case 'Active':
      return daysLeft !== null && daysLeft <= BusinessRules.LICENSE_GRACE_PERIOD_DAYS
        ? { kind: 'expiring', daysLeft: Math.max(0, daysLeft) }
        : null;
    default:
      return null; // null = chưa đồng bộ → để middleware quyết định, gặp 402 sẽ báo
  }
}

/**
 * Dẫn đường (YOLO trên máy + Hybrid) bị chặn khi CHƯA từng có gói (`None`) — Update Report §3.4.
 * Hết hạn (`Expired`) vẫn dẫn đường được. Chưa biết trạng thái (null) → không chặn.
 */
export const isNavigationAllowed = (status: string | null | undefined): boolean =>
  status !== 'None';

// ponytail: chỉ báo một lần mỗi lần mở app (lưu trong bộ nhớ) — đủ để không lặp sau mỗi request;
// lưu ngày vào SecureStore nếu người dùng thấy bị nhắc quá nhiều mỗi ngày.
const announced = new Set<LicenseEvent['kind']>();

/** TTS báo license, mỗi loại (bị chặn / sắp hết hạn) MỘT lần mỗi lần mở app. */
export function announceLicense(event: LicenseEvent): void {
  if (announced.has(event.kind)) return;
  announced.add(event.kind);
  ttsService.enqueue({
    text:
      event.kind === 'blocked'
        ? Strings.license.blocked
        : event.kind === 'trial'
          ? Strings.license.trial(event.daysLeft)
          : Strings.license.expiring(event.daysLeft),
    priority: TtsPriority.SYSTEM,
  });
}

/** Chỉ dùng trong test. */
export function resetLicenseNotice(): void {
  announced.clear();
}
