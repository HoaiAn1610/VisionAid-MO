import { ApiError } from '@/api/client';

/** Lỗi gửi lại không bao giờ hết (dữ liệu sai / đã đóng) → bỏ để hàng đợi không kẹt (§13). */
export function classifySyncError(error: unknown): 'retry' | 'drop' | 'gone' {
  if (!(error instanceof ApiError)) return 'retry';
  if (error.status === 404) return 'gone';
  if (error.status === 400 || error.status === 422) return 'drop';
  return 'retry'; // 0 (mạng), 401, 403, 429, 5xx
}
