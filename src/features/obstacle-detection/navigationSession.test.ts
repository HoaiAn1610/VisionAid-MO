import { syncOfflineNow } from '@/features/sync/offlineSync';
import * as repo from '@/services/storage/navigationRepo';

import {
  endNavigationSession,
  recordDetectionEvent,
  startNavigationSession,
} from './navigationSession';

jest.mock('@/services/storage/navigationRepo', () => ({
  insertSession: jest.fn(async () => {}),
  markSessionEnded: jest.fn(async () => {}),
  insertEvent: jest.fn(async () => {}),
}));
jest.mock('@/features/sync/offlineSync', () => ({ syncOfflineNow: jest.fn() }));
let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockUuid}` }));

beforeEach(() => jest.clearAllMocks());

describe('navigationSession', () => {
  it('start: tạo session ở máy (chưa có serverId) rồi đồng bộ', async () => {
    const localId = await startNavigationSession('Minimal');
    expect(repo.insertSession).toHaveBeenCalledWith(
      expect.objectContaining({ localId, serverId: null, detectionMode: 'Minimal', endedAt: null }),
    );
    expect(syncOfflineNow).toHaveBeenCalledTimes(1);
  });

  it('end: ghi endedAt rồi đồng bộ', async () => {
    await endNavigationSession('L1');
    expect(repo.markSessionEnded).toHaveBeenCalledWith('L1', expect.any(String));
    expect(syncOfflineNow).toHaveBeenCalled();
  });

  it('record: lưu event gắn với session local', async () => {
    const payload = {
      objectClass: 'car',
      confidenceScore: 0.9,
      distanceRange: 'Near' as const,
      alertIssued: true,
      detectedAt: 'now',
    };
    await recordDetectionEvent('L1', payload);
    expect(repo.insertEvent).toHaveBeenCalledWith(expect.any(String), 'L1', payload);
  });
});
