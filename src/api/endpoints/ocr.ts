import type { OcrResultStatus, TriggerMethod } from '@/constants/enums';

import { apiClient } from '../client';

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
