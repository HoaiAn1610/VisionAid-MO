/** Google không dùng được (mất mạng, không có dịch vụ, không hỗ trợ tiếng Việt…) → chuyển Vosk. */
export class SttUnavailableError extends Error {
  constructor(readonly code: string) {
    super(`Speech recognition unavailable: ${code}`);
  }
}
