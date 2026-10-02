import { endSession, logDetectionEvents, startSession } from '@/api/endpoints/navigation';
import { logQrScan, type QrScanLog } from '@/api/endpoints/ocr';
import { logVoiceCommand, type VoiceCommandLog } from '@/api/endpoints/voice';
import {
  syncNavigationSessions,
  type NavSyncDeps,
} from '@/features/obstacle-detection/navigationSync';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import * as navigationRepo from '@/services/storage/navigationRepo';
import { flushOfflineQueues, type FlushDeps } from '@/services/storage/offlineQueue';
import { logger } from '@/utils/logger';

const SYNC_INTERVAL_MS = 60_000;

const navigationDeps: NavSyncDeps = {
  api: { startSession, logEvents: logDetectionEvents, endSession },
  repo: navigationRepo,
};

/** Sender của từng hàng đợi; GPS / emergency thêm ở Sprint 6–7. */
const flushDeps: FlushDeps = {
  senders: {
    voice: { mode: 'single', send: (payload) => logVoiceCommand(payload as VoiceCommandLog) },
    qr: { mode: 'single', send: (payload) => logQrScan(payload as QrScanLog) },
  },
  syncNavigation: () => syncNavigationSessions(navigationDeps),
};

/** Đồng bộ ngay nếu đang online, theo thứ tự ưu tiên của hàng đợi offline; lỗi không lan ra UI (§13). */
export function syncOfflineNow(): void {
  if (!NetworkMonitor.isOnline()) return;
  flushOfflineQueues(flushDeps).catch((e: unknown) => logger.warn('Offline sync failed', e));
}

/** Chạy khi đã đăng nhập: đồng bộ định kỳ + khi có mạng lại (kể cả dữ liệu còn sót từ lần trước). */
export function startOfflineSyncLoop(): () => void {
  // ponytail: phiên dẫn đường bị bỏ dở được đóng với thời điểm mở app lại (không biết lúc app bị
  // tắt) → thời lượng phiên có thể dài hơn thực tế; ghi heartbeat định kỳ nếu cần số liệu chính xác.
  navigationRepo
    .endOpenSessions(new Date().toISOString())
    .catch((e: unknown) => logger.warn('Close stale sessions failed', e))
    .finally(syncOfflineNow);
  const timer = setInterval(syncOfflineNow, SYNC_INTERVAL_MS);
  const unsubscribe = NetworkMonitor.subscribe((status) => {
    if (status !== 'Offline') syncOfflineNow();
  });
  return () => {
    clearInterval(timer);
    unsubscribe();
  };
}
