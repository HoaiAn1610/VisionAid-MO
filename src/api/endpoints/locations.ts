import { z } from 'zod';

import type { NetworkStatus } from '@/constants/enums';

import { apiClient } from '../client';
import { apiResponseSchema } from '../types';

/** Khớp `RecordGpsLocationRequest` (POST /api/locations/gps, chỉ role VIU). */
export interface GpsPoint {
  /** Server chống trùng theo id này → gửi lại an toàn (§9.6). */
  clientGeneratedId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  altitude: number | null;
  speedMps: number | null;
  heading: number | null;
  /** 0–100. */
  batteryLevel: number | null;
  networkStatus: NetworkStatus;
  recordedAt: string;
}

const recordSchema = z.object({ formattedAddress: z.string().nullable() });

/** Gửi một điểm → server trả địa chỉ (reverse geocode). Điểm trùng id → địa chỉ null. */
export async function recordGps(point: GpsPoint): Promise<string | null> {
  const res = await apiClient.post('/api/locations/gps', point);
  return apiResponseSchema(recordSchema).parse(res.data).data.formattedAddress;
}

/** Gửi cả lô khi flush hàng đợi; server tự bỏ điểm trùng `clientGeneratedId`. */
export async function recordGpsBatch(points: GpsPoint[]): Promise<void> {
  await apiClient.post('/api/locations/gps/batch', points);
}

const myLocationSchema = z.object({ formattedAddress: z.string(), cachedAt: z.string() });

export type ServerLocation = z.infer<typeof myLocationSchema>;

/** Vị trí + địa chỉ server lưu gần nhất; chưa có dữ liệu → 404. */
export async function fetchMyLocation(): Promise<ServerLocation> {
  const res = await apiClient.get('/api/locations/me');
  return apiResponseSchema(myLocationSchema).parse(res.data).data;
}
