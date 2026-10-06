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
