import { ApiError } from '@/api/client';

import {
  syncNavigationSessions,
  type NavSyncDeps,
  type StoredEvent,
  type StoredSession,
} from './navigationSync';

jest.mock('@/services/storage/secureStorage', () => ({
  getTokens: jest.fn(async () => null),
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
  getOrCreateClientDeviceId: jest.fn(async () => 'device-1'),
}));

function fakeDeps(sessions: StoredSession[], events: StoredEvent[]) {
  const db = { sessions: [...sessions], events: [...events] };
  const calls: string[] = [];
  const api = {
    startSession: jest.fn(async (s: StoredSession) => {
      calls.push(`start:${s.localId}`);
      return `server-${s.localId}`;
    }),
    logEvents: jest.fn(async (serverId: string, batch: StoredEvent[]) => {
      calls.push(`events:${serverId}:${batch.length}`);
    }),
    endSession: jest.fn(async (serverId: string) => {
      calls.push(`end:${serverId}`);
    }),
  };
  const deps: NavSyncDeps = {
    api,
    repo: {
      listSessions: async () => db.sessions.map((s) => ({ ...s })),
      setServerId: async (localId, serverId) => {
        db.sessions = db.sessions.map((s) => (s.localId === localId ? { ...s, serverId } : s));
      },
      listEvents: async (localId, limit) =>
        db.events.filter((e) => e.localSessionId === localId).slice(0, limit),
      deleteEvents: async (ids) => {
        db.events = db.events.filter((e) => !ids.includes(e.id));
      },
      deleteSession: async (localId) => {
        db.sessions = db.sessions.filter((s) => s.localId !== localId);
        db.events = db.events.filter((e) => e.localSessionId !== localId);
      },
    },
    batchSize: 2,
  };
  return { db, api, calls, deps };
}

const session = (localId: string, over: Partial<StoredSession> = {}): StoredSession => ({
  localId,
  serverId: null,
  detectionMode: 'Full',
  startedAt: '2026-09-28T08:00:00+07:00',
  endedAt: null,
  ...over,
});
const event = (id: string, localSessionId: string): StoredEvent => ({
  id,
  localSessionId,
  payload: {
    objectClass: 'car',
    confidenceScore: 0.9,
    distanceRange: 'Near',
    alertIssued: true,
    detectedAt: '2026-09-28T08:00:01+07:00',
  },
});

describe('syncNavigationSessions', () => {
  it('session offline: tạo trên server → gửi event theo batch → kết thúc → xóa khỏi máy', async () => {
    const { db, calls, deps } = fakeDeps(
      [session('L1', { endedAt: '2026-09-28T08:10:00+07:00' })],
      [event('e1', 'L1'), event('e2', 'L1'), event('e3', 'L1')],
    );
    await syncNavigationSessions(deps);
    expect(calls).toEqual([
      'start:L1',
      'events:server-L1:2',
      'events:server-L1:1',
      'end:server-L1',
    ]);
    expect(db.sessions).toHaveLength(0);
    expect(db.events).toHaveLength(0);
  });

  it('session đang chạy: đã có serverId → chỉ gửi event, KHÔNG kết thúc', async () => {
    const { db, api, calls, deps } = fakeDeps(
      [session('L1', { serverId: 'S1' })],
      [event('e1', 'L1')],
    );
    await syncNavigationSessions(deps);
    expect(api.startSession).not.toHaveBeenCalled();
    expect(calls).toEqual(['events:S1:1']);
    expect(db.sessions).toHaveLength(1);
  });

  it('mất mạng giữa chừng → dừng, giữ nguyên event chưa gửi để lần sau', async () => {
    const { db, api, deps } = fakeDeps(
      [session('L1', { serverId: 'S1', endedAt: '2026-09-28T08:10:00+07:00' })],
      [event('e1', 'L1'), event('e2', 'L1'), event('e3', 'L1')],
    );
    api.logEvents
      .mockImplementationOnce(async () => {})
      .mockRejectedValueOnce(new ApiError(0, 'Network Error', ''));
    await syncNavigationSessions(deps);
    expect(db.events.map((e) => e.id)).toEqual(['e3']);
    expect(api.endSession).not.toHaveBeenCalled();
    expect(db.sessions).toHaveLength(1);
  });

  it('event bị từ chối vĩnh viễn (422 session đã kết thúc) → bỏ, không kẹt hàng đợi', async () => {
    const { db, api, deps } = fakeDeps(
      [session('L1', { serverId: 'S1', endedAt: '2026-09-28T08:10:00+07:00' })],
      [event('e1', 'L1')],
    );
    api.logEvents.mockRejectedValueOnce(new ApiError(422, 'Business Rule Violation', 'ended'));
    api.endSession.mockRejectedValueOnce(
      new ApiError(422, 'Business Rule Violation', 'already ended'),
    );
    await syncNavigationSessions(deps);
    expect(db.events).toHaveLength(0);
    expect(db.sessions).toHaveLength(0);
  });

  it('server không còn session (404) → bỏ session và event của nó', async () => {
    const { db, api, deps } = fakeDeps([session('L1', { serverId: 'S1' })], [event('e1', 'L1')]);
    api.logEvents.mockRejectedValueOnce(new ApiError(404, 'Not Found', ''));
    await syncNavigationSessions(deps);
    expect(db.sessions).toHaveLength(0);
    expect(db.events).toHaveLength(0);
  });

  it('401 (hết phiên đăng nhập) → dừng và giữ dữ liệu', async () => {
    const { db, api, deps } = fakeDeps([session('L1')], [event('e1', 'L1')]);
    api.startSession.mockRejectedValueOnce(new ApiError(401, 'Unauthorized', ''));
    await syncNavigationSessions(deps);
    expect(db.sessions).toHaveLength(1);
    expect(db.events).toHaveLength(1);
  });

  it('gọi sync khi đang chạy → chạy bù MỘT lần sau đó (phiên vừa dừng không phải chờ 60s)', async () => {
    const { db, api, deps } = fakeDeps([session('L1', { serverId: 'S1' })], []);
    const first = syncNavigationSessions(deps);
    // Người dùng dừng phiên trong lúc lần sync đầu đang chạy
    db.sessions = db.sessions.map((s) => ({ ...s, endedAt: '2026-09-28T08:10:00+07:00' }));
    const second = syncNavigationSessions(deps);
    await Promise.all([first, second]);
    expect(api.endSession).toHaveBeenCalledWith('S1', '2026-09-28T08:10:00+07:00');
  });

  it('không chạy song song hai lần sync (tránh gửi trùng event)', async () => {
    const { api, deps } = fakeDeps([session('L1', { serverId: 'S1' })], [event('e1', 'L1')]);
    await Promise.all([syncNavigationSessions(deps), syncNavigationSessions(deps)]);
    expect(api.logEvents).toHaveBeenCalledTimes(1);
  });
});
