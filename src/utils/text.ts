/** Chuẩn hóa transcript: lowercase + gộp khoảng trắng, GIỮ dấu tiếng Việt. */
export function normalizeTranscript(input: string): string {
  return input
    .normalize('NFC')
    .toLowerCase()
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
