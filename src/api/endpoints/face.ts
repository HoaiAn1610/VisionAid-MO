import { z } from 'zod';

import { apiClient } from '../client';
import { apiResponseSchema } from '../types';

import type { UploadImage } from './ocr';

const identifySchema = z.object({
  recognized: z.boolean(),
  // Backend trước `b878270` không có field này
  lowConfidence: z.boolean().optional().default(false),
  matchedPersonName: z.string().nullable(),
  relationship: z.string().nullable(),
});

export type FaceIdentification = z.infer<typeof identifySchema>;

/**
 * Nhận diện người quen trên server (FaceNet + pgvector, backend `a1e4df9`). Server tự ghi
 * recognition log → mobile KHÔNG gọi `/recognition-logs`. FaceNet không chạy → 422.
 */
export async function identifyFace(
  photo: UploadImage,
  timeoutMs: number,
): Promise<FaceIdentification> {
  const form = new FormData();
  form.append('photo', photo as unknown as Blob);
  const res = await apiClient.post('/api/face-registry/identify', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: timeoutMs,
  });
  return apiResponseSchema(identifySchema).parse(res.data).data;
}
