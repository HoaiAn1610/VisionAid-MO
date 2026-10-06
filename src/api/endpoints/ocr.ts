import { z } from 'zod';

import type { OcrResultStatus, TriggerMethod } from '@/constants/enums';

import { apiClient } from '../client';
import { apiResponseSchema } from '../types';

/** Ảnh gửi multipart theo kiểu React Native (`{ uri, name, type }` thay cho Blob). */
export interface UploadImage {
  uri: string;
  name: string;
  type: 'image/jpeg';
}

/** Khớp `ProcessQrScanRequest` (POST /api/ocr/qr-scans, multipart, chỉ role VIU). Không gửi ảnh. */
export interface QrScanLog {
  qrContent: string;
  qrType: string;
  isUrl: boolean;
  urlDomain: string | null;
  /** Code scanner của VisionCamera trên Android dùng ML Kit Barcode Scanning. */
  ocrEngine: 'MLKit';
  triggerMethod: TriggerMethod;
  resultStatus: OcrResultStatus;
  ttsAnnounced: boolean;
  scannedAt: string;
}

/** Giới hạn của ProcessQrScanValidator. */
export const MAX_QR_CONTENT = 2048;

export async function logQrScan(log: QrScanLog): Promise<void> {
  const form = new FormData();
  form.append('QrContent', log.qrContent.slice(0, MAX_QR_CONTENT));
  form.append('QrType', log.qrType);
  form.append('IsUrl', String(log.isUrl));
  if (log.urlDomain) form.append('UrlDomain', log.urlDomain.slice(0, 255));
  form.append('OcrEngine', log.ocrEngine);
  form.append('TriggerMethod', log.triggerMethod);
  form.append('ResultStatus', log.resultStatus);
  form.append('TtsAnnounced', String(log.ttsAnnounced));
  form.append('ScannedAt', log.scannedAt);
  await apiClient.post('/api/ocr/qr-scans', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

const serverOcrSchema = z.object({
  processedText: z.string().nullable(),
  confidenceScore: z.number().nullable().optional(),
  // Backend trước `b878270` không có field này → suy ra từ processedText
  serverOcrAvailable: z.boolean().optional(),
});

export interface ServerOcrResult {
  text: string | null;
  /** VietOCR có chạy không (false → đọc bằng máy). */
  available: boolean;
  /** Xác suất thấp nhất giữa các dòng (0–1); null nếu server không trả. */
  confidence: number | null;
}

/**
 * Đọc chữ trên server (VietOCR): gửi ảnh, KHÔNG gửi text → server tự nhận dạng và tự ghi log.
 * Vẫn gửi `ResultStatus=Failed` / `OcrEngine=pending`: khi VietOCR không chạy, log không bị ghi
 * nhầm thành `Success` / `Tesseract` (mặc định của backend, GAP-25); server ghi đè khi VietOCR chạy.
 */
export async function recognizeTextOnServer(
  image: UploadImage,
  trigger: TriggerMethod,
  timeoutMs: number,
): Promise<ServerOcrResult> {
  const form = new FormData();
  form.append('Image', image as unknown as Blob);
  form.append('TriggerMethod', trigger);
  form.append('ResultStatus', 'Failed');
  form.append('OcrEngine', 'pending');
  form.append('TtsAnnounced', 'false');
  form.append('RequestedAt', new Date().toISOString());
  const res = await apiClient.post('/api/ocr/requests', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: timeoutMs,
  });
  const data = apiResponseSchema(serverOcrSchema).parse(res.data).data;
  return {
    text: data.processedText,
    available: data.serverOcrAvailable ?? data.processedText !== null,
    confidence: data.confidenceScore ?? null,
  };
}

/** Log kết quả OCR trên máy (ML Kit) — không gửi ảnh, đi qua hàng đợi offline. */
export interface OcrTextLog {
  processedText: string | null;
  ocrEngine: 'MLKit';
  triggerMethod: TriggerMethod;
  resultStatus: OcrResultStatus;
  processingTimeMs: number;
  ttsAnnounced: boolean;
  requestedAt: string;
}

export async function logOcrText(log: OcrTextLog): Promise<void> {
  const form = new FormData();
  if (log.processedText) form.append('ProcessedText', log.processedText);
  form.append('OcrEngine', log.ocrEngine);
  form.append('TriggerMethod', log.triggerMethod);
  form.append('ResultStatus', log.resultStatus);
  form.append('ProcessingTimeMs', String(Math.max(1, log.processingTimeMs)));
  form.append('TtsAnnounced', String(log.ttsAnnounced));
  form.append('RequestedAt', log.requestedAt);
  await apiClient.post('/api/ocr/requests', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
