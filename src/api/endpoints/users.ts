import { z } from 'zod';

import type { DetectionMode } from '@/constants/enums';

import { ApiError, apiClient } from '../client';
import { apiResponseSchema } from '../types';

export interface TtsPreferences {
  speedRate: number;
  volumeLevel: number;
  detectionMode: DetectionMode;
}

const prefsSchema = z.object({
  speedRate: z.number(),
  volumeLevel: z.number(),
  detectionMode: z.enum(['Minimal', 'Full']),
});

/** Tùy chọn đã lưu trên server; người dùng chưa lưu lần nào → 404 → null (dùng mặc định). */
export async function fetchTtsPreferences(): Promise<TtsPreferences | null> {
  try {
    const res = await apiClient.get('/api/users/me/tts-preferences');
    return apiResponseSchema(prefsSchema).parse(res.data).data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** PUT là upsert — tạo nếu chưa có. */
export async function saveTtsPreferences(p: TtsPreferences): Promise<void> {
  await apiClient.put('/api/users/me/tts-preferences', p);
}
