import { BusinessRules } from '@/constants/businessRules';
import { REJECTION_WORDS } from '@/constants/voiceCommands';
import { TtsPriority, ttsService, type TtsService } from '@/services/tts/TtsService';

import { isConfirmation, normalizeTranscript, type SpeechAlternative } from './intentMatcher';

export type ConfirmationResult =
  { status: 'Confirmed'; confirmedAt: string } | { status: 'Cancelled' };

export interface ConfirmationFlow {
  /** Đưa vào câu nghe được trong lúc chờ xác nhận. */
  hear(alternatives: readonly SpeechAlternative[]): void;
  /** Hủy từ bên ngoài (chạm nút hủy, rời màn hình). */
  cancel(): void;
  readonly result: Promise<ConfirmationResult>;
  /** Đã có kết quả (đồng bộ — để vòng nghe dừng ngay, không mở mic thừa). */
  readonly settled: boolean;
}

interface Options {
  prompt: string;
  cancelledMessage: string;
  timeoutMs?: number;
  tts?: Pick<TtsService, 'enqueue' | 'isSpeaking' | 'onSpeakingChange'>;
}

const rejectionWords = REJECTION_WORDS.map(normalizeTranscript);

/**
 * Xác nhận lệnh nguy hiểm (BR-14): đọc câu hỏi → chờ tối đa 10 s kể từ khi đọc XONG câu hỏi.
 * "có / đồng ý / xác nhận" → Confirmed; "không / hủy / thôi" hoặc hết giờ → Cancelled + TTS báo hủy.
 * Câu nghe được khi TTS còn đọc bị bỏ qua — chính câu hỏi chứa chữ "có" (chống tự nghe, §9.7).
 */
export function startConfirmation({
  prompt,
  cancelledMessage,
  timeoutMs = BusinessRules.DANGEROUS_COMMAND_CONFIRM_TIMEOUT_SECONDS * 1000,
  tts = ttsService,
}: Options): ConfirmationFlow {
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let resolveResult: (r: ConfirmationResult) => void = () => {};
  const result = new Promise<ConfirmationResult>((resolve) => (resolveResult = resolve));

  const finish = (r: ConfirmationResult) => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    unsubscribe();
    if (r.status === 'Cancelled')
      tts.enqueue({ text: cancelledMessage, priority: TtsPriority.SYSTEM });
    resolveResult(r);
  };
  const startTimer = () => {
    if (timer || settled) return;
    timer = setTimeout(() => finish({ status: 'Cancelled' }), timeoutMs);
  };

  const unsubscribe = tts.onSpeakingChange((speaking) => {
    if (!speaking) startTimer();
  });
  tts.enqueue({ text: prompt, priority: TtsPriority.EMERGENCY });
  if (!tts.isSpeaking()) startTimer(); // TTS hỏng / không phát được → vẫn có hạn chờ

  return {
    hear(alternatives) {
      if (settled || tts.isSpeaking()) return;
      if (isConfirmation(alternatives)) {
        finish({ status: 'Confirmed', confirmedAt: new Date().toISOString() });
        return;
      }
      const top = normalizeTranscript(alternatives[0]?.transcript ?? '');
      if (rejectionWords.some((w) => ` ${top} `.includes(` ${w} `)))
        finish({ status: 'Cancelled' });
    },
    cancel: () => finish({ status: 'Cancelled' }),
    result,
    get settled() {
      return settled;
    },
  };
}
