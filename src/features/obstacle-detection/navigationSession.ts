import * as Crypto from 'expo-crypto';

import { endSession, logDetectionEvents, startSession } from '@/api/endpoints/navigation';
import type { DetectionMode } from '@/constants/enums';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import * as repo from '@/services/storage/navigationRepo';
import { flushOfflineQueues } from '@/services/storage/offlineQueue';
import { logger } from '@/utils/logger';

import {
  syncNavigationSessions,
  type DetectionEventPayload,
  type NavSyncDeps,
} from './navigationSync';

const SYNC_INTERVAL_MS = 60_000;

const deps: NavSyncDeps = {
  api: { startSession, logEvents: logDetectionEvents, endSession },
  repo,
};

/**
 * Đồng bộ ngay nếu đang online, theo thứ tự ưu tiên của hàng đợi offline; lỗi không lan ra UI (§13).
 * Sender của emergency/GPS/voice/QR được thêm khi các tính năng đó có (Sprint 4–7).
 */
export function syncNavigationNow(): void {
  if (!NetworkMonitor.isOnline()) return;
  flushOfflineQueues({ senders: {}, syncNavigation: () => syncNavigationSessions(deps) }).catch(
    (e: unknown) => logger.warn('Offline sync failed', e),
  );
}

/** Session tạo ở máy trước → dẫn đường vẫn chạy khi offline; đồng bộ lên server sau. */
export async function startNavigationSession(mode: DetectionMode): Promise<string> {
  const localId = Crypto.randomUUID();
  await repo.insertSession({
    localId,
    serverId: null,
    detectionMode: mode,
    startedAt: new Date().toISOString(),
    endedAt: null,
  });
  syncNavigationNow();
  return localId;
}

export async function endNavigationSession(localId: string): Promise<void> {
  await repo.markSessionEnded(localId, new Date().toISOString());
  syncNavigationNow();
}

export async function recordDetectionEvent(
  localId: string,
  payload: DetectionEventPayload,
): Promise<void> {
  await repo.insertEvent(Crypto.randomUUID(), localId, payload);
}

/** Chạy khi đã đăng nhập: đồng bộ định kỳ + khi có mạng lại (kể cả phiên còn sót từ lần trước). */
export function startNavigationSyncLoop(): () => void {
  // ponytail: phiên bị bỏ dở được đóng với thời điểm mở app lại (không biết lúc app bị tắt) → thời lượng
  // phiên có thể dài hơn thực tế; ghi heartbeat định kỳ nếu cần số liệu chính xác.
  repo
    .endOpenSessions(new Date().toISOString())
    .catch((e: unknown) => logger.warn('Close stale sessions failed', e))
    .finally(syncNavigationNow);
  const timer = setInterval(syncNavigationNow, SYNC_INTERVAL_MS);
  const unsubscribe = NetworkMonitor.subscribe((status) => {
    if (status !== 'Offline') syncNavigationNow();
  });
  return () => {
    clearInterval(timer);
    unsubscribe();
  };
}
