import type {
  DetectionEventPayload,
  StoredEvent,
  StoredSession,
} from '@/features/obstacle-detection/navigationSync';

import { getDb } from './db';

/** Giới hạn hàng đợi event (log, không phải emergency) — vượt thì bỏ event cũ nhất (§13). */
const MAX_PENDING_EVENTS = 5000;

interface SessionRow {
  local_id: string;
  server_id: string | null;
  detection_mode: StoredSession['detectionMode'];
  started_at: string;
  ended_at: string | null;
}

export async function insertSession(s: StoredSession): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO nav_sessions (local_id, server_id, detection_mode, started_at, ended_at) VALUES (?, ?, ?, ?, ?)',
    s.localId,
    s.serverId,
    s.detectionMode,
    s.startedAt,
    s.endedAt,
  );
}

export async function markSessionEnded(localId: string, endedAt: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE nav_sessions SET ended_at = ? WHERE local_id = ?', endedAt, localId);
}

export async function listSessions(): Promise<StoredSession[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SessionRow>('SELECT * FROM nav_sessions ORDER BY started_at');
  return rows.map((r) => ({
    localId: r.local_id,
    serverId: r.server_id,
    detectionMode: r.detection_mode,
    startedAt: r.started_at,
    endedAt: r.ended_at,
  }));
}

export async function setServerId(localId: string, serverId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE nav_sessions SET server_id = ? WHERE local_id = ?', serverId, localId);
}

export async function deleteSession(localId: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM pending_detection_events WHERE local_session_id = ?', localId);
    await db.runAsync('DELETE FROM nav_sessions WHERE local_id = ?', localId);
  });
}

export async function insertEvent(
  id: string,
  localSessionId: string,
  payload: DetectionEventPayload,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO pending_detection_events (id, payload, created_at, local_session_id) VALUES (?, ?, ?, ?)',
    id,
    JSON.stringify(payload),
    Date.now(),
    localSessionId,
  );
  await db.runAsync(
    `DELETE FROM pending_detection_events WHERE id IN (
       SELECT id FROM pending_detection_events ORDER BY created_at DESC LIMIT -1 OFFSET ?)`,
    MAX_PENDING_EVENTS,
  );
}

export async function listEvents(localSessionId: string, limit: number): Promise<StoredEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; payload: string }>(
    'SELECT id, payload FROM pending_detection_events WHERE local_session_id = ? ORDER BY created_at LIMIT ?',
    localSessionId,
    limit,
  );
  return rows.map((r) => ({
    id: r.id,
    localSessionId,
    payload: JSON.parse(r.payload) as DetectionEventPayload,
  }));
}

export async function deleteEvents(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM pending_detection_events WHERE id IN (${ids.map(() => '?').join(',')})`,
    ...ids,
  );
}
