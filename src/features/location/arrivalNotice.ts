import { Strings } from '@/constants/strings.vi';

/** Khớp `ArrivalNotificationPayload` của backend (SignalR, camelCase). */
export interface ArrivalNotification {
  viuId: string;
  savedLocationId: string;
  savedLocationName: string;
  ttsAnnouncement: string | null;
  latitude: number;
  longitude: number;
  occurredAt: string;
}

/**
 * FCM `data` (chỉ có chuỗi) → sự kiện đến nơi. Thiếu field cần thiết (backend chưa gửi đủ) → null,
 * không đọc gì: bỏ qua còn hơn đọc sai tên nơi.
 */
export function arrivalFromFcmData(
  data: Record<string, unknown> | undefined,
): ArrivalNotification | null {
  const text = (key: string) => (typeof data?.[key] === 'string' ? (data[key] as string) : '');
  if (text('notificationType') !== 'ArrivalNotification') return null;
  const savedLocationId = text('savedLocationId');
  const savedLocationName = text('savedLocationName').trim();
  const occurredAt = text('occurredAt');
  if (!savedLocationId || !savedLocationName || Number.isNaN(Date.parse(occurredAt))) return null;
  return {
    viuId: text('viuId'),
    savedLocationId,
    savedLocationName,
    ttsAnnouncement: text('ttsAnnouncement') || null,
    latitude: Number(text('latitude')) || 0,
    longitude: Number(text('longitude')) || 0,
    occurredAt,
  };
}

/** Nhớ đủ nhiều sự kiện gần đây để chống đọc lặp khi SignalR và FCM cùng gửi (§9.6). */
const MAX_REMEMBERED = 50;

/**
 * Đọc thông báo đến nơi quen (BR-32) đúng một lần cho mỗi sự kiện: cùng `savedLocationId` +
 * `occurredAt` đến từ SignalR lẫn FCM thì chỉ đọc lần đầu.
 */
export function createArrivalAnnouncer(announce: (text: string) => void) {
  const seen: string[] = [];
  return (n: ArrivalNotification): boolean => {
    const key = `${n.savedLocationId}|${Date.parse(n.occurredAt)}`;
    if (seen.includes(key)) return false;
    seen.push(key);
    if (seen.length > MAX_REMEMBERED) seen.shift();
    announce(Strings.location.arrived(n.savedLocationName, n.ttsAnnouncement?.trim() || null));
    return true;
  };
}
