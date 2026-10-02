import { ApiError } from '@/api/client';

import { enqueue, flushOfflineQueues, MAX_QUEUE_ITEMS, type QueueSender } from './offlineQueue';

// SQLite giả trong bộ nhớ: chỉ hiểu đúng 4 câu SQL mà offlineQueue dùng
type Row = { id: string; payload: string; created_at: number };
const mockTables = new Map<string, Row[]>();
const rowsOf = (t: string) => mockTables.get(t) ?? [];
jest.mock('./db', () => ({
  getDb: async () => ({
    runAsync: async (sql: string, ...p: unknown[]) => {
      const table = /(?:INTO|FROM) (\w+)/.exec(sql)?.[1] ?? '';
      if (sql.startsWith('INSERT')) {
        const [id, payload, created_at] = p as [string, string, number];
        mockTables.set(table, [...rowsOf(table), { id, payload, created_at }]);
      } else if (sql.includes('OFFSET')) {
        const keep = p[0] as number;
        const sorted = [...rowsOf(table)].sort((a, b) => b.created_at - a.created_at);
        mockTables.set(table, sorted.slice(0, keep));
      } else {
        mockTables.set(
          table,
          rowsOf(table).filter((r) => !p.includes(r.id)),
        );
      }
    },
    getAllAsync: async (sql: string, limit: number) => {
      const table = /FROM (\w+)/.exec(sql)?.[1] ?? '';
      return [...rowsOf(table)].sort((a, b) => a.created_at - b.created_at).slice(0, limit);
    },
  }),
}));
let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `id-${++mockUuid}` }));

let now = 0;
beforeEach(() => {
  mockTables.clear();
  now = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => ++now);
});
afterEach(() => jest.restoreAllMocks());

const httpError = (status: number) => new ApiError(status, '', '');
const single = (send: (p: unknown) => Promise<void>): QueueSender => ({ mode: 'single', send });

describe('offlineQueue', () => {
  it('flush theo thứ tự ưu tiên: emergency → GPS → detection → voice → QR → OCR', async () => {
    const order: string[] = [];
    await enqueue('ocr', 'o');
    await enqueue('qr', 'q');
    await enqueue('voice', 'v');
    await enqueue('gps', 'g');
    await enqueue('emergency', 'e');
    const log = (name: string) => single(async () => void order.push(name));

    await flushOfflineQueues({
      senders: {
        emergency: log('emergency'),
        gps: { mode: 'batch', send: async () => void order.push('gps') },
        voice: log('voice'),
        qr: log('qr'),
        ocr: log('ocr'),
      },
      syncNavigation: async () => void order.push('detection'),
    });
    expect(order).toEqual(['emergency', 'gps', 'detection', 'voice', 'qr', 'ocr']);
  });

  it('2xx → xóa; GPS gửi theo lô tối đa 100 điểm', async () => {
    for (let i = 0; i < 150; i++) await enqueue('gps', { i });
    const sizes: number[] = [];
    await flushOfflineQueues({
      senders: { gps: { mode: 'batch', send: async (b) => void sizes.push(b.length) } },
    });
    expect(sizes).toEqual([100, 50]);
    expect(rowsOf('pending_gps')).toHaveLength(0);
  });

  it('400/422/404 (vĩnh viễn) → bỏ item, gửi tiếp item sau', async () => {
    await enqueue('voice', 'bad');
    await enqueue('voice', 'ok');
    const sent: unknown[] = [];
    await flushOfflineQueues({
      senders: {
        voice: single(async (p) => {
          if (p === 'bad') throw httpError(422);
          sent.push(p);
        }),
      },
    });
    expect(sent).toEqual(['ok']);
    expect(rowsOf('pending_voice_logs')).toHaveLength(0);
  });

  it('lỗi tạm (mạng / 5xx / 401) → giữ item và dừng cả lượt, bậc dưới chưa gửi', async () => {
    await enqueue('emergency', 'e');
    const syncNavigation = jest.fn(async () => {});
    await flushOfflineQueues({
      senders: { emergency: single(async () => Promise.reject(httpError(0))) },
      syncNavigation,
    });
    expect(rowsOf('pending_emergency_events')).toHaveLength(1);
    expect(syncNavigation).not.toHaveBeenCalled();
  });

  it('vượt giới hạn → bỏ log cũ nhất; emergency KHÔNG BAO GIỜ bị bỏ', async () => {
    for (let i = 0; i <= MAX_QUEUE_ITEMS; i++) await enqueue('qr', i);
    expect(rowsOf('pending_qr_logs')).toHaveLength(MAX_QUEUE_ITEMS);
    expect(rowsOf('pending_qr_logs').some((r) => r.payload === '0')).toBe(false);

    for (let i = 0; i <= MAX_QUEUE_ITEMS; i++) await enqueue('emergency', i);
    expect(rowsOf('pending_emergency_events')).toHaveLength(MAX_QUEUE_ITEMS + 1);
  });

  it('hàng đợi chưa có sender → giữ nguyên dữ liệu', async () => {
    await enqueue('gps', 'g');
    await flushOfflineQueues({ senders: {} });
    expect(rowsOf('pending_gps')).toHaveLength(1);
  });
});
