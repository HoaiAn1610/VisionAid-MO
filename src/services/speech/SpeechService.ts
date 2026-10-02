import type { RecognitionEngine } from '@/constants/enums';
import { Strings } from '@/constants/strings.vi';
import { CONFIRMATION_WORDS, VoiceCommands } from '@/constants/voiceCommands';
import type { SpeechAlternative } from '@/features/voice-commands/intentMatcher';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import { TtsPriority, ttsService, type TtsService } from '@/services/tts/TtsService';

import { createEchoGuard, type EchoGuard } from './echoGuard';
import { recognizeWithGoogle, type SttSession } from './engines';
import { isOnDeviceSpeechReady } from './onDeviceSpeech';
import { SttUnavailableError } from './sttErrors';

export interface ListenOutcome {
  engine: RecognitionEngine;
  /** Rỗng = không nghe thấy gì, hoặc bị bỏ vì là tiếng của chính TTS. */
  alternatives: SpeechAlternative[];
  discardedAsEcho: boolean;
  isOffline: boolean;
  processingTimeMs: number;
}

/** Offline mà máy không nhận dạng tiếng Việt trên máy được. Đã báo bằng TTS → dùng nút chạm. */
export class OfflineSpeechUnavailableError extends Error {
  constructor() {
    super('On-device Vietnamese speech recognition unavailable');
  }
}

const PHRASES = [...VoiceCommands.flatMap((c) => c.keywords), ...CONFIRMATION_WORDS];

export interface SpeechDeps {
  google(contextualStrings: string[], onDevice: boolean): SttSession;
  isOnline(): boolean;
  isOfflineReady(): boolean;
  tts: Pick<TtsService, 'enqueue' | 'isSpeaking' | 'onSpeakingChange'>;
  createGuard(): EchoGuard;
}

const defaultDeps: SpeechDeps = {
  google: recognizeWithGoogle,
  isOnline: () => NetworkMonitor.isOnline(),
  isOfflineReady: isOnDeviceSpeechReady,
  tts: ttsService,
  createGuard: () => createEchoGuard(),
};

/**
 * Nghe MỘT câu lệnh (ADR 0002): online → Google; Google online không dùng được hoặc offline →
 * Google nhận dạng ngay trên máy + TTS báo (BR-16, báo một lần cho tới khi online chạy lại).
 * Máy không nhận dạng trên máy được (Android ≤ 12, thiếu gói vi-VN) → TTS hướng dẫn dùng nút chạm. Mic chỉ mở khi TTS đã im, và kết quả
 * trùng lúc TTS phát bị bỏ (echo guard, §9.7).
 */
export function createSpeechService(deps: SpeechDeps = defaultDeps) {
  let current: SttSession | null = null;
  let fallbackAnnounced = false;

  const waitForSilence = () =>
    new Promise<void>((resolve) => {
      if (!deps.tts.isSpeaking()) return resolve();
      const off = deps.tts.onSpeakingChange((speaking) => {
        if (speaking) return;
        off();
        resolve();
      });
    });

  async function run(
    engine: RecognitionEngine,
    start: () => SttSession,
    isOffline: boolean,
  ): Promise<ListenOutcome> {
    await waitForSilence();
    const guard = deps.createGuard();
    guard.markListeningStart();
    current = start();
    try {
      const r = await current.promise;
      const echo = guard.shouldDiscard();
      return {
        engine,
        alternatives: echo ? [] : r.alternatives,
        discardedAsEcho: echo,
        isOffline,
        processingTimeMs: r.processingTimeMs,
      };
    } finally {
      guard.dispose();
      current = null;
    }
  }

  async function listenOffline(): Promise<ListenOutcome> {
    const unavailable = () => {
      deps.tts.enqueue({ text: Strings.voice.offlineUnavailable, priority: TtsPriority.SYSTEM });
      return new OfflineSpeechUnavailableError();
    };
    if (!deps.isOfflineReady()) throw unavailable();
    if (!fallbackAnnounced) {
      fallbackAnnounced = true;
      deps.tts.enqueue({ text: Strings.voice.offlineEngine, priority: TtsPriority.SYSTEM });
    }
    try {
      return await run('GoogleOnDevice', () => deps.google(PHRASES, true), true);
    } catch (e) {
      throw e instanceof SttUnavailableError ? unavailable() : e;
    }
  }

  return {
    async listenOnce(): Promise<ListenOutcome> {
      current?.abort();
      if (!deps.isOnline()) return listenOffline();
      try {
        const outcome = await run('GoogleSpeech', () => deps.google(PHRASES, false), false);
        fallbackAnnounced = false;
        return outcome;
      } catch (e) {
        if (!(e instanceof SttUnavailableError)) throw e;
        return listenOffline();
      }
    },
    abort(): void {
      current?.abort();
    },
  };
}

export const speechService = createSpeechService();
