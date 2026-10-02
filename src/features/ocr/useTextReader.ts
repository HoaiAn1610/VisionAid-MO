import TextRecognition from '@react-native-ml-kit/text-recognition';

import { recognizeTextOnServer } from '@/api/endpoints/ocr';
import type { TriggerMethod } from '@/constants/enums';
import { Strings } from '@/constants/strings.vi';
import { say, useCaptureAndSpeak } from '@/features/capture/useCaptureAndSpeak';
import { syncOfflineNow } from '@/features/sync/offlineSync';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import { enqueue } from '@/services/storage/offlineQueue';
import { logger } from '@/utils/logger';

import { readText, type ReadTextDeps } from './readText';

/** Đủ nét cho chữ biển hiệu / giấy tờ, ảnh JPEG thường < 1MB. */
const OCR_MAX_SIDE = 1600;

const deps: ReadTextDeps = {
  isOnline: () => NetworkMonitor.isOnline(),
  recognizeOnServer: (image, trigger, timeoutMs) =>
    recognizeTextOnServer(image, trigger, timeoutMs),
  recognizeOnDevice: async (uri) => (await TextRecognition.recognize(uri)).text,
  logOnDevice: (log) => {
    enqueue('ocr', log)
      .then(syncOfflineNow)
      .catch((e: unknown) => logger.warn('Record OCR log failed', e));
  },
  onSlow: () => say(Strings.ocr.reading),
  now: Date.now,
};

/** Đọc chữ (FE-06, §9.3): VietOCR trên server, offline / server lỗi → ML Kit trên máy. */
export function useTextReader(trigger: TriggerMethod) {
  return useCaptureAndSpeak({
    aim: Strings.ocr.aim,
    maxSide: OCR_MAX_SIDE,
    process: async (image) => {
      if (!NetworkMonitor.isOnline()) say(Strings.ocr.offline);
      const { text } = await readText(image, trigger, deps);
      return text ?? Strings.ocr.notClear;
    },
    describeError: () => Strings.errors.unavailable,
  });
}
