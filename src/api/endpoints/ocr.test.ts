import { apiClient } from '../client';

import { logQrScan } from './ocr';

jest.mock('../client', () => ({ apiClient: { post: jest.fn(async () => ({ data: {} })) } }));

describe('logQrScan', () => {
  it('gửi multipart đúng tên field PascalCase của ProcessQrScanRequest, không gửi ảnh', async () => {
    await logQrScan({
      qrContent: 'https://example.com',
      qrType: 'Url',
      isUrl: true,
      urlDomain: 'example.com',
      ocrEngine: 'MLKit',
      triggerMethod: 'Tap',
      resultStatus: 'Success',
      ttsAnnounced: true,
      scannedAt: '2026-10-02T10:00:00.000Z',
    });
    const [url, form] = (apiClient.post as jest.Mock).mock.calls[0] as [string, FormData];
    expect(url).toBe('/api/ocr/qr-scans');
    expect(Object.fromEntries(form as unknown as Iterable<[string, string]>)).toEqual({
      QrContent: 'https://example.com',
      QrType: 'Url',
      IsUrl: 'true',
      UrlDomain: 'example.com',
      OcrEngine: 'MLKit',
      TriggerMethod: 'Tap',
      ResultStatus: 'Success',
      TtsAnnounced: 'true',
      ScannedAt: '2026-10-02T10:00:00.000Z',
    });
  });
});
