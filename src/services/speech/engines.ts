import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import type { SpeechAlternative } from '@/features/voice-commands/intentMatcher';

import { SttUnavailableError } from './sttErrors';

export interface SttResult {
  alternatives: SpeechAlternative[];
  /** Từ lúc bắt đầu nghe tới khi có kết quả. */
  processingTimeMs: number;
}

export interface SttSession {
  promise: Promise<SttResult>;
  abort(): void;
}

/** Không nghe thấy gì: kết quả rỗng, KHÔNG phải lý do chuyển engine. */
const NO_RESULT_CODES = new Set(['no-speech', 'speech-timeout', 'aborted']);

/** Google Speech qua SpeechRecognizer của Android (ADR 0002). `onDevice`: nhận dạng ngay trên máy. */
export function recognizeWithGoogle(contextualStrings: string[], onDevice = false): SttSession {
  const startedAt = Date.now();
  const subs: { remove(): void }[] = [];
  const cleanup = () => subs.splice(0).forEach((s) => s.remove());
  let alternatives: SpeechAlternative[] = [];

  const promise = new Promise<SttResult>((resolve, reject) => {
    const done = () => resolve({ alternatives, processingTimeMs: Date.now() - startedAt });
    subs.push(
      ExpoSpeechRecognitionModule.addListener('result', (e) => {
        if (!e.isFinal) return;
        alternatives = e.results.map((r) => ({
          transcript: r.transcript,
          confidence: r.confidence,
        }));
      }),
      ExpoSpeechRecognitionModule.addListener('error', (e) => {
        cleanup();
        if (NO_RESULT_CODES.has(e.error)) done();
        else reject(new SttUnavailableError(e.error));
      }),
      ExpoSpeechRecognitionModule.addListener('end', () => {
        cleanup();
        done();
      }),
    );
    ExpoSpeechRecognitionModule.start({
      lang: 'vi-VN',
      interimResults: false,
      maxAlternatives: 3,
      continuous: false,
      requiresOnDeviceRecognition: onDevice,
      contextualStrings,
      // Google khuyên dùng cho câu 1–2 từ (lệnh ngắn)
      androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'web_search' },
    });
  });
  return { promise, abort: () => ExpoSpeechRecognitionModule.abort() };
}
