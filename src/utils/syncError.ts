import { ApiError } from '@/api/client';

/** Lỗi gửi lại không bao giờ hết (dữ liệu sai / đã đóng) → bỏ để hàng đợi không kẹt (§13). */
export function classifySyncError(error: unknown): 'retry' | 'drop' | 'gone' {
  if (!(error instanceof ApiError)) return 'retry';
  if (error.status === 404) return 'gone';
  // 409 (backend `b878270`: trùng unique) → dữ liệu đã có trên server, gửi lại vô ích
  if (error.status === 400 || error.status === 409 || error.status === 422) return 'drop';
  return 'retry'; // 0 (mạng), 401, 403, 429, 5xx
}
