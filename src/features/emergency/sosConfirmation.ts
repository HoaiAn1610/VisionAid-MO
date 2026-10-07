/** Cờ xác nhận chỉ sống ngắn: đủ để chuyển màn, không đủ để bị dùng lại về sau. */
const VALID_MS = 5000;

let confirmedAt: number | null = null;

/**
 * Lệnh giọng nói "gọi khẩn cấp" đã qua bước xác nhận (BR-14) → đánh dấu trong BỘ NHỚ để màn khẩn cấp
 * gửi ngay. KHÔNG truyền qua tham số route: route nào cũng mở được bằng deep link `visionaid://…`,
 * app khác có thể giả "đã xác nhận" để kích hoạt SOS và tự gọi điện.
 */
export function markSosConfirmedByVoice(now: number = Date.now()): void {
  confirmedAt = now;
}

/** Đọc và XÓA cờ (dùng một lần). Quá 5 giây → coi như chưa xác nhận. */
export function consumeSosConfirmation(now: number = Date.now()): boolean {
  const at = confirmedAt;
  confirmedAt = null;
  return at !== null && now - at >= 0 && now - at <= VALID_MS;
}
