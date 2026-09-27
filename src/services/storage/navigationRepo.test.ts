import * as repo from './navigationRepo';

// DB giả: ghi lại câu SQL + tham số để kiểm tra repo gửi đúng lệnh (SQLite thật chỉ có trên máy)
const mockCalls: { sql: string; params: unknown[] }[] = [];
let mockRows: unknown[] = [];
jest.mock('./db', () => ({
  getDb: async () => ({
    runAsync: async (sql: string, ...params: unknown[]) => {
      mockCalls.push({ sql, params });
    },
    getAllAsync: async (sql: string, ...params: unknown[]) => {
      mockCalls.push({ sql, params });
      return mockRows;
    },
    withTransactionAsync: async (fn: () => Promise<void>) => fn(),
  }),
}));

beforeEach(() => {
  mockCalls.length = 0;
  mockRows = [];
});

describe('navigationRepo', () => {
  it('listSessions đổi snake_case → camelCase, sắp theo started_at', async () => {
    mockRows = [
      {
        local_id: 'L1',
        server_id: null,
        detection_mode: 'Full',
        started_at: 't0',
        ended_at: null,
      },
    ];
    expect(await repo.listSessions()).toEqual([
      { localId: 'L1', serverId: null, detectionMode: 'Full', startedAt: 't0', endedAt: null },
    ]);
    expect(mockCalls[0]?.sql).toMatch(/ORDER BY started_at/);
  });

  it('insertEvent lưu payload JSON rồi cắt hàng đợi còn 5000 event mới nhất', async () => {
    await repo.insertEvent('e1', 'L1', {
      objectClass: 'car',
      confidenceScore: 0.9,
      distanceRange: 'Near',
      alertIssued: true,
      detectedAt: 't',
    });
    expect(mockCalls[0]?.params[0]).toBe('e1');
    expect(JSON.parse(mockCalls[0]?.params[1] as string)).toMatchObject({ objectClass: 'car' });
    expect(mockCalls[0]?.params[3]).toBe('L1');
    expect(mockCalls[1]?.sql).toMatch(/OFFSET \?/);
    expect(mockCalls[1]?.params).toEqual([5000]);
  });

  it('listEvents parse payload và gắn localSessionId', async () => {
    mockRows = [{ id: 'e1', payload: '{"objectClass":"bus"}' }];
    expect(await repo.listEvents('L1', 100)).toEqual([
      { id: 'e1', localSessionId: 'L1', payload: { objectClass: 'bus' } },
    ]);
    expect(mockCalls[0]?.params).toEqual(['L1', 100]);
  });

  it('deleteEvents: danh sách rỗng không chạy SQL; có id thì dùng placeholder', async () => {
    await repo.deleteEvents([]);
    expect(mockCalls).toHaveLength(0);
    await repo.deleteEvents(['a', 'b']);
    expect(mockCalls[0]?.sql).toMatch(/IN \(\?,\?\)/);
    expect(mockCalls[0]?.params).toEqual(['a', 'b']);
  });

  it('deleteSession xóa cả event của phiên', async () => {
    await repo.deleteSession('L1');
    expect(mockCalls.map((c) => c.sql)).toEqual([
      expect.stringMatching(/DELETE FROM pending_detection_events/),
      expect.stringMatching(/DELETE FROM nav_sessions/),
    ]);
  });

  it('insertSession / markSessionEnded / setServerId truyền đúng tham số', async () => {
    await repo.insertSession({
      localId: 'L1',
      serverId: null,
      detectionMode: 'Minimal',
      startedAt: 't0',
      endedAt: null,
    });
    await repo.markSessionEnded('L1', 't1');
    await repo.setServerId('L1', 'S1');
    expect(mockCalls.map((c) => c.params)).toEqual([
      ['L1', null, 'Minimal', 't0', null],
      ['t1', 'L1'],
      ['S1', 'L1'],
    ]);
  });
});
