import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { recordGpsBatch, type GpsPoint } from '@/api/endpoints/locations';
import { Strings } from '@/constants/strings.vi';
import { enqueue, flushQueue, type QueueSender } from '@/services/storage/offlineQueue';
import { logger } from '@/utils/logger';

import { toGpsPoint } from './gps';

export const GPS_TASK = 'visionaid-gps-tracking';

/**
 * `session`: đang dẫn đường → dày (UC-22). `low-power`: ngoài phiên vẫn gửi thưa để cảnh báo vùng
 * an toàn / báo đến nơi quen hoạt động (§9.6, đề xuất chờ nhóm chốt).
 */
export type GpsMode = 'session' | 'low-power';

const notification = {
  notificationTitle: Strings.location.trackingTitle,
  notificationBody: Strings.location.trackingBody,
  killServiceOnDestroy: false,
};

const OPTIONS: Record<GpsMode, Location.LocationTaskOptions> = {
  session: {
    accuracy: Location.Accuracy.High,
    timeInterval: 10_000,
    distanceInterval: 10,
    foregroundService: notification,
  },
  'low-power': {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 120_000,
    distanceInterval: 100,
    deferredUpdatesInterval: 120_000,
    foregroundService: notification,
  },
};

/** GPS gửi theo lô qua `/gps/batch`; server tự bỏ điểm trùng `clientGeneratedId` (§13). */
export const gpsSender: QueueSender = {
  mode: 'batch',
  send: (points) => recordGpsBatch(points as GpsPoint[]),
};

// Phải định nghĩa ở phạm vi module, nạp lúc khởi động (app/_layout.tsx) — Android có thể gọi task
// khi app đã bị tắt. Mọi điểm vào hàng đợi SQLite trước, gửi ngay nếu được; không phụ thuộc SignalR.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  GPS_TASK,
  async ({ data, error }) => {
    if (error || !data) {
      logger.warn('GPS task error', error?.message);
      return;
    }
    try {
      for (const location of data.locations) await enqueue('gps', await toGpsPoint(location));
      await flushQueue('gps', gpsSender);
    } catch (e) {
      logger.warn('GPS task failed', e);
    }
  },
);

let currentMode: GpsMode | null = null;

/**
 * Bật / đổi chế độ theo dõi. Chỉ chạy khi đã có quyền vị trí (xin quyền theo ngữ cảnh ở nơi gọi)
 * và phải gọi lúc app đang mở (Android chặn khởi động foreground service từ nền).
 */
export async function setGpsMode(mode: GpsMode): Promise<void> {
  if (mode === currentMode) return;
  try {
    if (!(await Location.getForegroundPermissionsAsync()).granted) return;
    await Location.startLocationUpdatesAsync(GPS_TASK, OPTIONS[mode]);
    currentMode = mode;
  } catch (e) {
    logger.warn('Start GPS tracking failed', e);
  }
}

/** Logout / phiên hết hạn → dừng chia sẻ vị trí. */
export async function stopGpsTracking(): Promise<void> {
  currentMode = null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(GPS_TASK)) {
      await Location.stopLocationUpdatesAsync(GPS_TASK);
    }
  } catch (e) {
    logger.warn('Stop GPS tracking failed', e);
  }
}
