import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { z } from 'zod';

import type { GuidanceAction, GuidanceObject } from '@/features/obstacle-detection/hybridGuidance';
import type { StoredEvent, StoredSession } from '@/features/obstacle-detection/navigationSync';

import { apiClient } from '../client';
import { apiResponseSchema } from '../types';

const sessionSchema = z.object({ id: z.string() });

/** POST /api/navigation/sessions — gửi `startedAt` gốc để session tạo offline giữ đúng thời điểm. */
export async function startSession(s: StoredSession): Promise<string> {
  const res = await apiClient.post('/api/navigation/sessions', {
    detectionMode: s.detectionMode,
    deviceModel: (Platform.constants as { Model?: string }).Model,
    appVersion: Constants.expoConfig?.version,
    startedAt: s.startedAt,
  });
  return apiResponseSchema(sessionSchema).parse(res.data).data.id;
}

export async function logDetectionEvents(serverId: string, events: StoredEvent[]): Promise<void> {
  await apiClient.post(
    `/api/navigation/sessions/${serverId}/events/batch`,
    events.map((e) => e.payload),
  );
}

const guidanceSchema = z.object({
  action: z.enum(['STOP', 'TURN_LEFT', 'TURN_RIGHT', 'PROCEED']),
});

/**
 * Hybrid AI (§9.1): gửi vật MEDIUM/FAR lên Decision Engine (JEV → Groq → Rule-Based). Chỉ lấy
 * `action` — câu đọc dựng trên máy. `timeoutMs` = `navigation_near_threshold_ms`: quá → luật trên máy.
 */
export async function requestGuidance(
  sessionId: string,
  frameId: number,
  detectedObjects: GuidanceObject[],
  timeoutMs: number,
): Promise<GuidanceAction> {
  const res = await apiClient.post(
    '/api/navigation/guidance',
    { sessionId, frameId, detectedObjects },
    { timeout: timeoutMs },
  );
  return apiResponseSchema(guidanceSchema).parse(res.data).data.action;
}

export async function endSession(serverId: string, endedAt: string): Promise<void> {
  await apiClient.patch(`/api/navigation/sessions/${serverId}/end`, { endedAt });
}
