/**
 * Lọc deep link từ ngoài vào (`visionaid://…` do app khác / đường link mở). Màn khẩn cấp không bao giờ
 * được mở từ bên ngoài: SOS chỉ bắt đầu từ chính người dùng trong app (nút, giọng nói, té ngã).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return /(^|\/)emergency(\/|\?|$)/i.test(path) ? '/' : path;
  } catch {
    return '/';
  }
}
