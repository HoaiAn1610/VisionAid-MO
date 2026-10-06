import { z } from 'zod';

import type { DetectionMethod, EmergencyContactType } from '@/constants/enums';

import { apiClient } from '../client';
import { apiResponseSchema } from '../types';

const contactSchema = z.object({
  id: z.string(),
  contactName: z.string(),
  contactType: z.enum(['Phone', 'Zalo', 'Both']),
  phoneNumber: z.string().nullable(),
  zaloDeepLink: z.string().nullable(),
  priorityOrder: z.number(),
  isActive: z.boolean(),
});

export interface EmergencyContact {
  id: string;
  contactName: string;
  contactType: EmergencyContactType;
  phoneNumber: string | null;
  zaloDeepLink: string | null;
  priorityOrder: number;
}

/** Caregiver cấu hình; VIU chỉ đọc. Đã sắp theo `priorityOrder`. Chỉ giữ contact đang bật. */
export async function fetchEmergencyContacts(): Promise<EmergencyContact[]> {
  const res = await apiClient.get('/api/users/me/emergency-contacts');
  return apiResponseSchema(z.array(contactSchema))
    .parse(res.data)
    .data.filter((c) => c.isActive)
    .map(({ isActive: _active, ...c }) => c);
}

/** Khớp `CreateEmergencyEventRequest`. `detectedAt` là giờ thiết bị — server tính grace từ đây. */
export interface EmergencyEventPayload {
  detectionMethod: DetectionMethod;
  detectedAt: string;
  latitude: number | null;
  longitude: number | null;
  accelerometerData?: string;
  notes?: string;
  snapshotBase64?: string;
  snapshotContentType?: 'image/jpeg';
}

const eventSchema = z.object({ id: z.string(), currentStatus: z.string() });

export type EmergencyEvent = z.infer<typeof eventSchema>;

/** `AccelerometerCamera` → `Detected` (15 s grace); Manual / VoiceCommand / Gesture → `Sent` ngay. */
export async function createEmergencyEvent(
  payload: EmergencyEventPayload,
): Promise<EmergencyEvent> {
  const res = await apiClient.post('/api/emergency-events', payload);
  return apiResponseSchema(eventSchema).parse(res.data).data;
}

/** Hủy cảnh báo té ngã trong grace period; quá hạn → 422. */
export async function dismissEmergencyEvent(id: string, notes?: string): Promise<void> {
  await apiClient.put(`/api/emergency-events/${id}/dismiss`, { notes });
}
