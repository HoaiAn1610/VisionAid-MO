import type { OcrTextLog, ServerOcrResult, UploadImage } from '@/api/endpoints/ocr';
import { BusinessRules } from '@/constants/businessRules';
import { configNumber } from '@/services/config/runtimeConfig';
import type { TriggerMethod } from '@/constants/enums';
import { logger } from '@/utils/logger';

/** Quá thời gian này mới có kết quả → báo "Đang đọc" (§9.3). */
export const SLOW_NOTICE_MS = 1500;
/** Server chậm hơn thế này → bỏ, đọc bằng máy (mục tiêu OCR ≤ 3s P95). */
export const SERVER_TIMEOUT_MS = 8000;

export interface ReadTextDeps {
  isOnline(): boolean;
  /** VietOCR trên server (tự ghi log). */
  recognizeOnServer(
    image: UploadImage,
    trigger: TriggerMethod,
    timeoutMs: number,
  ): Promise<ServerOcrResult>;
  /** ML Kit trên máy. */
  recognizeOnDevice(uri: string): Promise<string>;
  logOnDevice(log: OcrTextLog): void;
  onSlow(): void;
  now(): number;
}

export interface ReadTextResult {
  /** `null` → không đọc rõ (BR-24: yêu cầu chụp lại, không đọc đoán). */
  text: string | null;
  source: 'server' | 'device';
}

/** Gộp xuống dòng / khoảng trắng thừa để TTS đọc liền mạch. */
export const normalizeText = (raw: string | null | undefined): string | null =>
  raw?.replace(/\s+/g, ' ').trim() || null;

/**
 * OCR lai (§9.3): online → VietOCR trên server (server tự ghi log). Offline, server lỗi/chậm, VietOCR
 * không chạy (`serverOcrAvailable = false`), không ra chữ hoặc độ tin cậy thấp (BR-24) → ML Kit trên
 * máy, log qua hàng đợi offline.
 */
export async function readText(
  image: UploadImage,
  trigger: TriggerMethod,
  deps: ReadTextDeps,
): Promise<ReadTextResult> {
  const slow = setTimeout(deps.onSlow, SLOW_NOTICE_MS);
  try {
    if (deps.isOnline()) {
      try {
        const server = await deps.recognizeOnServer(image, trigger, SERVER_TIMEOUT_MS);
        const text = normalizeText(server.text);
        const confident =
          server.confidence === null ||
          server.confidence >=
            configNumber('ocr_confidence_threshold', BusinessRules.OCR_MIN_CONFIDENCE);
        if (server.available && text && confident) return { text, source: 'server' };
      } catch (e) {
        logger.warn('Server OCR failed, using on-device', e);
      }
    }

    const startedAt = deps.now();
    const requestedAt = new Date(startedAt).toISOString();
    let text: string | null = null;
    try {
      text = normalizeText(await deps.recognizeOnDevice(image.uri));
    } catch (e) {
      logger.warn('On-device OCR failed', e);
    }
    deps.logOnDevice({
      processedText: text,
      ocrEngine: 'MLKit',
      triggerMethod: trigger,
      resultStatus: text ? 'Success' : 'Failed',
      processingTimeMs: deps.now() - startedAt,
      ttsAnnounced: true,
      requestedAt,
    });
    return { text, source: 'device' };
  } finally {
    clearTimeout(slow);
  }
}
