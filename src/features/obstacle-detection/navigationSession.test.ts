import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import * as repo from '@/services/storage/navigationRepo';

import {
  endNavigationSession,
  recordDetectionEvent,
  startNavigationSession,
  startNavigationSyncLoop,
} from './navigationSession';
import { syncNavigationSessions } from './navigationSync';

jest.mock('@/services/storage/navigationRepo', () => ({
  insertSession: jest.fn(async () => {}),
  markSessionEnded: jest.fn(async () => {}),
  insertEvent: jest.fn(async () => {}),
  endOpenSessions: jest.fn(async () => {}),
}));
jest.mock('./navigationSync', () => ({ syncNavigationSessions: jest.fn(async () => {}) }));
jest.mock('@/api/endpoints/navigation', () => ({}));
jest.mock('@/services/network/NetworkMonitor', () => {
  let listener: ((s: string) => void) | null = null;
  return {
    NetworkMonitor: {
      isOnline: jest.fn(() => true),
      subscribe: jest.fn((l: (s: string) => void) => {
        listener = l;
        return () => {
          listener = null;
        };
      }),
      emit: (s: string) => listener?.(s),
    },
  };
});
let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockUuid}` }));

const net = NetworkMonitor as unknown as {
  isOnline: jest.Mock;
  emit: (s: string) => void;
};
const sync = syncNavigationSessions as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  net.isOnline.mockReturnValue(true);
});

describe('navigationSession', () => {
  it('start: tạo session ở máy (chưa có serverId) rồi đồng bộ ngay khi online', async () => {
    const localId = await startNavigationSession('Minimal');
    expect(repo.insertSession).toHaveBeenCalledWith(
      expect.objectContaining({ localId, serverId: null, detectionMode: 'Minimal', endedAt: null }),
    );
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('offline: vẫn tạo session ở máy, KHÔNG gọi đồng bộ', async () => {
    net.isOnline.mockReturnValue(false);
    await startNavigationSession('Full');
    expect(repo.insertSession).toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });

  it('end: ghi endedAt rồi đồng bộ', async () => {
    await endNavigationSession('L1');
    expect(repo.markSessionEnded).toHaveBeenCalledWith('L1', expect.any(String));
    expect(sync).toHaveBeenCalled();
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

  it('mở app: đóng các phiên còn mở từ lần trước (app bị tắt giữa chừng) rồi mới đồng bộ', async () => {
    const stop = startNavigationSyncLoop();
    await Promise.resolve();
    await Promise.resolve();
    expect(repo.endOpenSessions).toHaveBeenCalledWith(expect.any(String));
    expect((repo.endOpenSessions as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      sync.mock.invocationCallOrder[0] ?? Infinity,
    );
    stop();
  });

  it('sync loop: đồng bộ lúc bắt đầu, định kỳ và khi có mạng lại; dọn dẹp khi dừng', async () => {
    jest.useFakeTimers();
    const stop = startNavigationSyncLoop();
    await Promise.resolve();
    await Promise.resolve();
    expect(sync).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(60_000);
    expect(sync).toHaveBeenCalledTimes(2);
    net.emit('Wifi');
    expect(sync).toHaveBeenCalledTimes(3);
    net.emit('Offline');
    expect(sync).toHaveBeenCalledTimes(3);
    stop();
    jest.advanceTimersByTime(120_000);
    expect(sync).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('lỗi đồng bộ không lan ra ngoài', async () => {
    sync.mockRejectedValueOnce(new Error('boom'));
    await expect(endNavigationSession('L1')).resolves.toBeUndefined();
  });
});
