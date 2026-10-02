import { ttsService, type TtsService } from '@/services/tts/TtsService';

/** Tiếng loa còn vang / mic còn đệm sau khi TTS dừng. */
const ECHO_TAIL_MS = 500;

export interface EchoGuard {
  /** Gọi ngay khi bắt đầu thu âm một lượt nói. */
  markListeningStart(): void;
  /** true → transcript của lượt này có thể là tiếng của chính TTS → phải bỏ (§9.7, §16.20). */
  shouldDiscard(): boolean;
  dispose(): void;
}

/**
 * Chống tự nghe: câu TTS chứa chính lệnh ("Nói 'Tôi ổn' để hủy", "Nói 'có' để xác nhận").
 * STT trả kết quả SAU khi nói xong — lúc đó TTS có thể đã dừng — nên phải xét cả khoảng thu âm,
 * không chỉ thời điểm nhận kết quả.
 */
export function createEchoGuard(
  tts: Pick<TtsService, 'isSpeaking' | 'onSpeakingChange'> = ttsService,
  now: () => number = Date.now,
): EchoGuard {
  let listeningSince = now();
  // Mốc gần nhất TTS bắt đầu hoặc dừng phát — dừng sau mốc thu âm nghĩa là đã phát trong lúc thu
  let lastAudibleAt = tts.isSpeaking() ? now() : Number.NEGATIVE_INFINITY;
  const unsubscribe = tts.onSpeakingChange(() => {
    lastAudibleAt = now();
  });

  return {
    markListeningStart() {
      listeningSince = now();
    },
    shouldDiscard() {
      return tts.isSpeaking() || lastAudibleAt >= listeningSince - ECHO_TAIL_MS;
    },
    dispose: unsubscribe,
  };
}
