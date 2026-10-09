import { ApiError } from '@/api/client';
import type { FaceIdentification } from '@/api/endpoints/face';
import { Strings } from '@/constants/strings.vi';

/** Câu TTS cho kết quả nhận diện (§9.4) — dựng từ strings.vi, không đọc `ttsText` của server. */
export function describeIdentification(r: FaceIdentification): string {
  const name = r.matchedPersonName?.trim();
  if (r.lowConfidence) return Strings.face.lowConfidence;
  if (!r.recognized || !name) return Strings.face.notMatched;
  return Strings.face.matched(name, r.relationship?.trim() || null);
}

/**
 * Mất mạng giữa chừng → cần mạng. 422 có `errorCode: FACE_SERVICE_UNAVAILABLE` → FaceNet không chạy;
 * 422 khác (không thấy khuôn mặt — backend chưa gắn mã, GAP-26) → hướng dẫn chụp lại.
 * 5xx / timeout → tạm không khả dụng.
 */
export function describeFaceError(error: unknown, online: boolean): string {
  if (error instanceof ApiError && error.status === 0 && !online) {
    return Strings.errors.faceNeedsNetwork;
  }
  if (error instanceof ApiError && error.status === 422) {
    return error.errorCode === 'FACE_SERVICE_UNAVAILABLE'
      ? Strings.face.unavailable
      : Strings.face.retake;
  }
  return Strings.face.unavailable;
}
