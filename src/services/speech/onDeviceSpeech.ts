import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Platform } from 'react-native';

import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import { logger } from '@/utils/logger';

/** Dịch vụ nhận dạng ngay trên máy của Google (Android System Intelligence). */
const ON_DEVICE_SERVICE = 'com.google.android.as';
const LOCALE = 'vi-VN';

let ready = false;

/** Đã kiểm tra: máy nhận dạng tiếng Việt offline được (Android 13+, có dịch vụ + gói vi-VN). */
export function isOnDeviceSpeechReady(): boolean {
  return ready;
}

async function refresh(): Promise<boolean> {
  if (Platform.OS !== 'android' || !ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
    return (ready = false);
  }
  const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({
    androidRecognitionServicePackage: ON_DEVICE_SERVICE,
  });
  return (ready = installedLocales.some((l) => l.toLowerCase().startsWith('vi')));
}

/**
 * Kiểm tra gói vi-VN; chưa có thì tải khi đang Wi-Fi — CHỈ Android 14+ (tải ngầm). Android 13 hệ
 * thống bật hộp thoại mà người khiếm thị không thao tác được → không tự gọi (ADR 0002).
 */
async function setup(): Promise<void> {
  if (await refresh()) return;
  const canDownloadSilently =
    ExpoSpeechRecognitionModule.supportsOnDeviceRecognition() && Number(Platform.Version) >= 34;
  if (!canDownloadSilently || NetworkMonitor.getStatus() !== 'Wifi') return;
  const { status } = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
    locale: LOCALE,
  });
  if (status === 'download_success') await refresh();
}

/** Chạy khi đã đăng nhập: kiểm tra ngay và mỗi khi chuyển sang Wi-Fi. */
export function startOnDeviceSpeechSetup(): () => void {
  const run = () => setup().catch((e: unknown) => logger.warn('On-device speech setup failed', e));
  void run();
  return NetworkMonitor.subscribe((status) => {
    if (status === 'Wifi' && !ready) void run();
  });
}
