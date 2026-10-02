import * as Crypto from 'expo-crypto';

import type { DetectionMode } from '@/constants/enums';
import { syncOfflineNow } from '@/features/sync/offlineSync';
import * as repo from '@/services/storage/navigationRepo';

import type { DetectionEventPayload } from './navigationSync';

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
  syncOfflineNow();
  return localId;
}

export async function endNavigationSession(localId: string): Promise<void> {
  await repo.markSessionEnded(localId, new Date().toISOString());
  syncOfflineNow();
}

export async function recordDetectionEvent(
  localId: string,
  payload: DetectionEventPayload,
): Promise<void> {
  await repo.insertEvent(Crypto.randomUUID(), localId, payload);
}
