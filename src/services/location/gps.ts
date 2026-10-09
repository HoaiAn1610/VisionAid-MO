import NetInfo from '@react-native-community/netinfo';
import * as Battery from 'expo-battery';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { Linking } from 'react-native';

import type { GpsPoint } from '@/api/endpoints/locations';
import { Strings } from '@/constants/strings.vi';
import { toNetworkStatus } from '@/services/network/NetworkMonitor';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { logger } from '@/utils/logger';

/** Không bắt được tín hiệu mới trong khoảng này → dùng vị trí cuối cùng đã biết (§5.10). */
const FIX_TIMEOUT_MS = 10_000;
const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;

const positive = (n: number | null | undefined) => (n != null && n >= 0 ? n : null);

/**
 * Đổi vị trí của expo-location thành điểm gửi server. Đọc mạng / pin trực tiếp (không qua
 * NetworkMonitor) vì task nền có thể chạy khi app đã bị tắt.
 */
export async function toGpsPoint(location: Location.LocationObject): Promise<GpsPoint> {
  const [battery, net] = await Promise.all([
    Battery.getBatteryLevelAsync().catch(() => -1),
    NetInfo.fetch().catch(() => null),
  ]);
  const { coords } = location;
  return {
    clientGeneratedId: Crypto.randomUUID(),
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracyMeters: coords.accuracy && coords.accuracy > 0 ? coords.accuracy : null,
    altitude: coords.altitude ?? null,
    speedMps: positive(coords.speed),
    heading: positive(coords.heading),
    batteryLevel: battery >= 0 ? Math.round(battery * 100) : null,
    networkStatus: net ? toNetworkStatus(net) : 'Offline',
    recordedAt: new Date(location.timestamp).toISOString(),
  };
}

/** Xin quyền vị trí khi dùng app: giải thích bằng TTS trước hộp thoại hệ thống (§14). */
export async function ensureLocationPermission(): Promise<boolean> {
  if ((await Location.getForegroundPermissionsAsync()).granted) return true;
  ttsService.enqueue({ text: Strings.location.permissionExplain, priority: TtsPriority.FEEDBACK });
  if ((await Location.requestForegroundPermissionsAsync()).granted) return true;
  ttsService.enqueue({ text: Strings.location.permissionDenied, priority: TtsPriority.SYSTEM });
  await Linking.openSettings().catch((e: unknown) => logger.warn('Open settings failed', e));
  return false;
}

/** Có quyền nhưng người dùng tắt Vị trí của máy → báo (người chăm sóc mất vị trí mà không ai biết). */
export async function warnIfLocationServicesOff(): Promise<void> {
  const enabled = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!enabled)
    ttsService.enqueue({ text: Strings.location.servicesOff, priority: TtsPriority.SYSTEM });
}

/** Điểm GPS hiện tại; mất tín hiệu → vị trí cuối cùng đã biết; không có quyền → null. */
export async function getCurrentPoint(): Promise<GpsPoint | null> {
  if (!(await Location.getForegroundPermissionsAsync()).granted) return null;
  const fresh = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
  ]).catch((e: unknown) => {
    logger.warn('Get current position failed', e);
    return null;
  });
  const location =
    fresh ??
    (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(() => null));
  return location ? toGpsPoint(location) : null;
}

/** SOS không được chờ GPS lâu: vị trí đã biết trong 2 phút, không có thì chờ tối đa 3 giây. */
export async function getQuickPosition(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    if (!(await Location.getForegroundPermissionsAsync()).granted) return null;
    const known = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000 });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const location =
      known ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), 3000))),
      ]).finally(() => clearTimeout(timer)));
    return location
      ? { latitude: location.coords.latitude, longitude: location.coords.longitude }
      : null;
  } catch (e) {
    logger.warn('Quick position failed', e);
    return null;
  }
}
