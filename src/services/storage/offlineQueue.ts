import * as Crypto from 'expo-crypto';

import { ApiError } from '@/api/client';
import { logger } from '@/utils/logger';
import { classifySyncError } from '@/utils/syncError';

import { getDb } from './db';

/**
 * Hàng đợi offline dùng chung (CLAUDE.md §13) cho các log gửi độc lập với phiên dẫn đường.
 * Detection event gắn với phiên nên đồng bộ riêng (navigationSync), chen vào đúng bậc "logs".
 */
export type QueueName = 'emergency' | 'gps' | 'voice' | 'qr' | 'ocr';

const TABLES: Record<QueueName, string> = {
  emergency: 'pending_emergency_events',
  gps: 'pending_gps',
  voice: 'pending_voice_logs',
  qr: 'pending_qr_logs',
  ocr: 'pending_ocr_logs',
};

/** Vượt giới hạn → bỏ item cũ nhất. Emergency KHÔNG BAO GIỜ bị bỏ (§16.19). */
export const MAX_QUEUE_ITEMS = 5000;
/** Endpoint batch của backend chưa giới hạn số phần tử (GAP-14) → client tự chia lô. */
const BATCH_SIZE = 100;

/** `single`: gửi từng item (emergency, voice, QR, OCR). `batch`: gửi cả lô (GPS qua `/gps/batch`). */
export type QueueSender =
  | { mode: 'single'; send(payload: unknown): Promise<void> }
  | { mode: 'batch'; send(payloads: unknown[]): Promise<void> };

/** `ownerId` chỉ dùng cho emergency (hàng đợi duy nhất còn lại sau logout). */
export async function enqueue(
  queue: QueueName,
  payload: unknown,
  ownerId: string | null = null,
): Promise<void> {
  const db = await getDb();
  const table = TABLES[queue];
  if (queue === 'emergency') {
    await db.runAsync(
      `INSERT INTO ${table} (id, payload, created_at, owner_id) VALUES (?, ?, ?, ?)`,
      Crypto.randomUUID(),
      JSON.stringify(payload),
      Date.now(),
      ownerId,
    );
    return; // emergency KHÔNG BAO GIỜ bị cắt bớt (§16.19)
  }
  await db.runAsync(
    `INSERT INTO ${table} (id, payload, created_at) VALUES (?, ?, ?)`,
    Crypto.randomUUID(),
    JSON.stringify(payload),
    Date.now(),
  );
  await db.runAsync(
    `DELETE FROM ${table} WHERE id IN (
       SELECT id FROM ${table} ORDER BY created_at DESC LIMIT -1 OFFSET ?)`,
    MAX_QUEUE_ITEMS,
  );
}

/**
 * Gửi hết một hàng đợi theo thứ tự cũ → mới. Xóa khi 2xx hoặc lỗi vĩnh viễn; lỗi tạm → dừng.
 * `ownerId` (emergency): chỉ gửi dòng của user đang đăng nhập (dòng cũ chưa có chủ vẫn gửi).
 */
export async function flushQueue(
  queue: QueueName,
  sender: QueueSender,
  ownerId?: string,
): Promise<'done' | 'retry-later'> {
  const db = await getDb();
  const table = TABLES[queue];
  const limit = sender.mode === 'batch' ? BATCH_SIZE : 1;
  for (;;) {
    const rows =
      ownerId === undefined
        ? await db.getAllAsync<{ id: string; payload: string }>(
            `SELECT id, payload FROM ${table} ORDER BY created_at LIMIT ?`,
            limit,
          )
        : await db.getAllAsync<{ id: string; payload: string }>(
            `SELECT id, payload FROM ${table} WHERE owner_id = ? OR owner_id IS NULL ORDER BY created_at LIMIT ?`,
            ownerId,
            limit,
          );
    if (rows.length === 0) return 'done';
    const payloads = rows.map((r) => JSON.parse(r.payload) as unknown);
    try {
      if (sender.mode === 'batch') await sender.send(payloads);
      else await sender.send(payloads[0]);
    } catch (e) {
      if (classifySyncError(e) === 'retry') {
        // status 0 = mất mạng: chuyện thường khi offline, không cần cảnh báo mỗi lần thử
        const offline = e instanceof ApiError && e.status === 0;
        (offline ? logger.debug : logger.warn)(
          `Offline queue ${queue} paused`,
          e instanceof ApiError ? e.status : e,
        );
        return 'retry-later';
      }
      // 400/409/422: payload không bao giờ hợp lệ được nữa. Emergency → mức error để dễ thấy
      (queue === 'emergency' ? logger.error : logger.warn)(
        `Offline queue ${queue} dropped rejected items`,
        rows.length,
      );
    }
    await db.runAsync(
      `DELETE FROM ${table} WHERE id IN (${rows.map(() => '?').join(',')})`,
      ...rows.map((r) => r.id),
    );
  }
}

export interface FlushDeps {
  /** Hàng đợi chưa có sender (tính năng chưa làm) thì giữ nguyên, không gửi. */
  senders: Partial<Record<QueueName, QueueSender>>;
  /** Session + detection event (navigationSync) — bậc "logs", sau GPS. */
  syncNavigation?: () => Promise<void>;
  /** User đang đăng nhập — emergency chỉ gửi dòng của người này; null → chưa gửi emergency. */
  currentUserId?: () => string | null;
}

// ponytail: lỗi tạm thì dừng và chờ lần gọi kế tiếp (vòng 60s / có mạng lại), không có exponential
// backoff — thêm `attempts` + backoff nếu server bị dồn request khi nhiều máy cùng có mạng lại.
let running: Promise<void> | null = null;
let rerunRequested = false;

/**
 * Đồng bộ theo thứ tự ưu tiên: emergency → GPS → logs (detection, voice, QR, OCR).
 * Bậc trên gặp lỗi tạm → dừng cả lượt (mạng có vấn đề thì bậc dưới cũng sẽ lỗi).
 * Single-flight; gọi thêm khi đang chạy → chạy bù một lần sau đó.
 */
export function flushOfflineQueues(deps: FlushDeps): Promise<void> {
  if (running) {
    rerunRequested = true;
    return running;
  }
  running = (async () => {
    do {
      rerunRequested = false;
      await flushInOrder(deps);
    } while (rerunRequested);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function flushInOrder({ senders, syncNavigation, currentUserId }: FlushDeps): Promise<void> {
  const owner = currentUserId?.();
  if (senders.emergency && owner !== null) {
    if ((await flushQueue('emergency', senders.emergency, owner)) === 'retry-later') return;
  }
  if (senders.gps && (await flushQueue('gps', senders.gps)) === 'retry-later') return;
  await syncNavigation?.();
  for (const queue of ['voice', 'qr', 'ocr'] as const) {
    const sender = senders[queue];
    if (sender && (await flushQueue(queue, sender)) === 'retry-later') return;
  }
}
