import { ApiError } from '@/api/client';
import type { DetectionMode, DistanceRange } from '@/constants/enums';
import { logger } from '@/utils/logger';

/** Session luôn tạo ở máy trước (offline-first); `serverId` có sau khi đồng bộ được. */
export interface StoredSession {
  localId: string;
  serverId: string | null;
  detectionMode: DetectionMode;
  startedAt: string;
  endedAt: string | null;
}

/** Khớp `LogDetectionEventRequest` của backend. */
export interface DetectionEventPayload {
  objectClass: string;
  confidenceScore: number;
  distanceRange: DistanceRange;
  boundingBox?: string;
  alertIssued: boolean;
  inferenceTimeMs?: number;
  detectedAt: string;
  latitude?: number;
  longitude?: number;
}

export interface StoredEvent {
  id: string;
  localSessionId: string;
  payload: DetectionEventPayload;
}

export interface NavSyncDeps {
  api: {
    startSession(s: StoredSession): Promise<string>;
    logEvents(serverId: string, events: StoredEvent[]): Promise<void>;
    endSession(serverId: string, endedAt: string): Promise<void>;
  };
  repo: {
    listSessions(): Promise<StoredSession[]>;
    setServerId(localId: string, serverId: string): Promise<void>;
    listEvents(localId: string, limit: number): Promise<StoredEvent[]>;
    deleteEvents(ids: string[]): Promise<void>;
    deleteSession(localId: string): Promise<void>;
  };
  batchSize?: number;
}

type Outcome = 'ok' | 'retry-later' | 'drop-session';

/** Lỗi không bao giờ tự hết khi gửi lại (dữ liệu sai / session đã đóng) → bỏ để không kẹt. */
function classify(error: unknown): 'retry' | 'drop' | 'gone' {
  if (!(error instanceof ApiError)) return 'retry';
  if (error.status === 404) return 'gone';
  if (error.status === 400 || error.status === 422) return 'drop';
  return 'retry'; // 0 (mạng), 401, 403, 429, 5xx
}

let running: Promise<void> | null = null;

/**
 * Đồng bộ session + detection event theo thứ tự backend yêu cầu:
 * tạo session (kèm startedAt gốc) → gửi HẾT event (batch) → rồi mới kết thúc session
 * (server từ chối event của session đã kết thúc). Single-flight để không gửi trùng.
 */
export function syncNavigationSessions(deps: NavSyncDeps): Promise<void> {
  running ??= run(deps).finally(() => {
    running = null;
  });
  return running;
}

async function run(deps: NavSyncDeps): Promise<void> {
  for (const s of await deps.repo.listSessions()) {
    const outcome = await syncOne(s, deps);
    if (outcome === 'retry-later') return; // mạng/phiên đăng nhập có vấn đề → thử lại toàn bộ sau
    if (outcome === 'drop-session') await deps.repo.deleteSession(s.localId);
  }
}

async function syncOne(s: StoredSession, deps: NavSyncDeps): Promise<Outcome> {
  let serverId = s.serverId;
  if (!serverId) {
    try {
      serverId = await deps.api.startSession(s);
      await deps.repo.setServerId(s.localId, serverId);
    } catch (e) {
      return fail('start session', e);
    }
  }

  const batchSize = deps.batchSize ?? 100;
  for (;;) {
    const batch = await deps.repo.listEvents(s.localId, batchSize);
    if (batch.length === 0) break;
    try {
      await deps.api.logEvents(serverId, batch);
    } catch (e) {
      const kind = classify(e);
      if (kind === 'retry') return fail('log events', e);
      if (kind === 'gone') return 'drop-session';
      logger.warn('Dropping rejected detection events', batch.length);
    }
    await deps.repo.deleteEvents(batch.map((ev) => ev.id));
  }

  if (!s.endedAt) return 'ok'; // phiên đang chạy — kết thúc ở lần sync sau khi người dùng dừng
  try {
    await deps.api.endSession(serverId, s.endedAt);
  } catch (e) {
    if (classify(e) === 'retry') return fail('end session', e);
    // 404/422 (không còn / đã kết thúc) → coi như xong
  }
  return 'drop-session';
}

function fail(step: string, e: unknown): Outcome {
  const kind = classify(e);
  if (kind === 'retry') {
    logger.warn(`Navigation sync paused at ${step}`, e instanceof ApiError ? e.status : e);
    return 'retry-later';
  }
  logger.warn(`Navigation session dropped at ${step}`, e instanceof ApiError ? e.status : e);
  return 'drop-session';
}
