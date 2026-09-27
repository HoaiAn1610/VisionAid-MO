import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { z } from 'zod';

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

export async function endSession(serverId: string, endedAt: string): Promise<void> {
  await apiClient.patch(`/api/navigation/sessions/${serverId}/end`, { endedAt });
}
