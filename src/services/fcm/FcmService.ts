import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';

import { updateFcmToken } from '@/api/endpoints/auth';
import { arrivalFromFcmData } from '@/features/location/arrivalNotice';
import { announceArrival } from '@/features/location/useArrivalNotifications';
import { getOrCreateClientDeviceId } from '@/services/storage/secureStorage';
import { logger } from '@/utils/logger';

/** Lấy token không được làm chậm đăng nhập quá lâu (không có Google Play Services / mạng chậm). */
const TOKEN_TIMEOUT_MS = 5000;

/** FCM token gửi kèm `device.fcmToken` khi đăng nhập (§6); lỗi → null, vẫn đăng nhập bình thường. */
export async function getFcmToken(): Promise<string | null> {
  try {
    return await Promise.race([
      getToken(getMessaging()),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TOKEN_TIMEOUT_MS)),
    ]);
  } catch (e) {
    logger.warn('Get FCM token failed', e);
    return null;
  }
}

/** Chỉ cần `data` (RemoteMessage không được export ở API modular). */
function handleMessage(message: { data?: Record<string, unknown> }): void {
  const arrival = arrivalFromFcmData(message.data);
  if (arrival) announceArrival(arrival); // chống trùng với SignalR bên trong announceArrival
}

// App ở nền / đã tắt: Android chạy handler này (headless). Phải đăng ký ở phạm vi module, nạp lúc
// khởi động (app/_layout.tsx).
setBackgroundMessageHandler(getMessaging(), async (message) => handleMessage(message));

/** Khi đã đăng nhập: nhận thông báo lúc app đang mở + cập nhật token khi Firebase đổi token. */
export function startFcm(): () => void {
  const messaging = getMessaging();
  const offMessage = onMessage(messaging, handleMessage);
  const offRefresh = onTokenRefresh(messaging, (token) => {
    void getOrCreateClientDeviceId()
      .then((clientDeviceId) => updateFcmToken(token, clientDeviceId))
      .catch((e: unknown) => logger.warn('Update FCM token failed', e));
  });
  return () => {
    offMessage();
    offRefresh();
  };
}
