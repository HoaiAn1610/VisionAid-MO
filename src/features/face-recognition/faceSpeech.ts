import { ApiError } from '@/api/client';
import type { FaceIdentification } from '@/api/endpoints/face';
import { Strings } from '@/constants/strings.vi';

/** Câu TTS cho kết quả nhận diện (§9.4) — dựng từ strings.vi, không đọc `ttsText` của server. */
export function describeIdentification(r: FaceIdentification): string {
  const name = r.matchedPersonName?.trim();
  if (!r.recognized || !name) return Strings.face.notMatched;
  return Strings.face.matched(name, r.relationship?.trim() || null);
}

/** Mất mạng giữa chừng → cần mạng; còn lại (422 FaceNet lỗi, 5xx, timeout) → tạm không khả dụng. */
export function describeFaceError(error: unknown, online: boolean): string {
  if (error instanceof ApiError && error.status === 0 && !online) {
    return Strings.errors.faceNeedsNetwork;
  }
  return Strings.face.unavailable;
}
