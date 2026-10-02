import { logQrScan } from '@/api/endpoints/ocr';
import { logVoiceCommand } from '@/api/endpoints/voice';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import * as repo from '@/services/storage/navigationRepo';
import { flushOfflineQueues, type FlushDeps } from '@/services/storage/offlineQueue';

import { startOfflineSyncLoop, syncOfflineNow } from './offlineSync';

jest.mock('@/services/storage/navigationRepo', () => ({
  endOpenSessions: jest.fn(async () => {}),
}));
jest.mock('@/services/storage/offlineQueue', () => ({
  flushOfflineQueues: jest.fn(async () => {}),
}));
jest.mock('@/features/obstacle-detection/navigationSync', () => ({
  syncNavigationSessions: jest.fn(async () => {}),
}));
jest.mock('@/api/endpoints/navigation', () => ({}));
jest.mock('@/api/endpoints/voice', () => ({ logVoiceCommand: jest.fn(async () => {}) }));
jest.mock('@/api/endpoints/ocr', () => ({ logQrScan: jest.fn(async () => {}) }));
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

const net = NetworkMonitor as unknown as { isOnline: jest.Mock; emit: (s: string) => void };
const flush = flushOfflineQueues as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  net.isOnline.mockReturnValue(true);
});

describe('offlineSync', () => {
  it('online → flush hàng đợi, có sender cho voice log và QR log', () => {
    syncOfflineNow();
    const deps = flush.mock.calls[0][0] as FlushDeps;
    const voice = deps.senders.voice;
    expect(voice?.mode).toBe('single');
    if (voice?.mode === 'single') void voice.send({ executionStatus: 'Success' });
    expect(logVoiceCommand).toHaveBeenCalledWith({ executionStatus: 'Success' });
    const qr = deps.senders.qr;
    if (qr?.mode === 'single') void qr.send({ qrContent: 'x' });
    expect(logQrScan).toHaveBeenCalledWith({ qrContent: 'x' });
  });

  it('offline → không gọi đồng bộ', () => {
    net.isOnline.mockReturnValue(false);
    syncOfflineNow();
    expect(flush).not.toHaveBeenCalled();
  });

  it('lỗi đồng bộ không lan ra ngoài', () => {
    flush.mockRejectedValueOnce(new Error('boom'));
    expect(() => syncOfflineNow()).not.toThrow();
  });

  it('mở app: đóng các phiên còn mở từ lần trước rồi mới đồng bộ', async () => {
    const stop = startOfflineSyncLoop();
    await Promise.resolve();
    await Promise.resolve();
    expect(repo.endOpenSessions).toHaveBeenCalledWith(expect.any(String));
    expect((repo.endOpenSessions as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      flush.mock.invocationCallOrder[0] ?? Infinity,
    );
    stop();
  });

  it('vòng đồng bộ: lúc bắt đầu, định kỳ 60 s, khi có mạng lại; dọn dẹp khi dừng', async () => {
    jest.useFakeTimers();
    const stop = startOfflineSyncLoop();
    await Promise.resolve();
    await Promise.resolve();
    expect(flush).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(60_000);
    expect(flush).toHaveBeenCalledTimes(2);
    net.emit('Wifi');
    expect(flush).toHaveBeenCalledTimes(3);
    net.emit('Offline');
    expect(flush).toHaveBeenCalledTimes(3);
    stop();
    jest.advanceTimersByTime(120_000);
    expect(flush).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });
});
