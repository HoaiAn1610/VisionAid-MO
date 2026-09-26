import * as Speech from 'expo-speech';

import { BusinessRules } from '@/constants/businessRules';
import { logger } from '@/utils/logger';

/** Số nhỏ hơn = ưu tiên cao hơn (FE-35). */
export enum TtsPriority {
  EMERGENCY = 0,
  DANGER = 1,
  SYSTEM = 2,
  FEEDBACK = 3,
  INFO = 4,
}

export interface TtsRequest {
  text: string;
  priority: TtsPriority;
  /** Khóa cooldown (ví dụ object_class). Bỏ qua với EMERGENCY. */
  cooldownKey?: string;
  /** Item chờ quá lâu sẽ bị drop (ví dụ announce vật cản của cycle cũ). */
  maxAgeMs?: number;
}

export interface TtsSettings {
  language: string;
  rate: number;
  volume: number;
  voice?: string;
}

/** Tách khỏi expo-speech để unit test được. */
export interface SpeechEngine {
  speak(text: string, options: Speech.SpeechOptions): void;
  stop(): Promise<void>;
}

interface QueuedItem extends TtsRequest {
  enqueuedAt: number;
  seq: number;
}

type SpeakingListener = (speaking: boolean) => void;

const expoSpeechEngine: SpeechEngine = {
  speak: (text, options) => Speech.speak(text, options),
  stop: () => Speech.stop(),
};

export class TtsService {
  private queue: QueuedItem[] = [];
  private current: QueuedItem | null = null;
  private utteranceToken = 0;
  private seq = 0;
  private lastSpokenByKey = new Map<string, number>();
  private listeners = new Set<SpeakingListener>();
  private lastText: string | null = null;
  private cooldownMs: number = BusinessRules.TTS_COOLDOWN_SECONDS * 1000;
  private settings: TtsSettings = { language: 'vi-VN', rate: 1.0, volume: 1.0 };

  constructor(
    private readonly engine: SpeechEngine = expoSpeechEngine,
    private readonly now: () => number = Date.now,
  ) {}

  updateSettings(partial: Partial<TtsSettings>): void {
    const next = { ...this.settings, ...partial };
    next.rate = clamp(next.rate, BusinessRules.TTS_MIN_SPEED, BusinessRules.TTS_MAX_SPEED);
    next.volume = clamp(next.volume, BusinessRules.TTS_MIN_VOLUME, BusinessRules.TTS_MAX_VOLUME);
    this.settings = next;
  }

  getSettings(): TtsSettings {
    return { ...this.settings };
  }

  setCooldownSeconds(seconds: number): void {
    this.cooldownMs = seconds * 1000;
  }

  /** @returns false nếu bị bỏ qua (cooldown / trùng lặp). */
  enqueue(request: TtsRequest): boolean {
    const now = this.now();
    const isEmergency = request.priority === TtsPriority.EMERGENCY;

    if (!isEmergency && request.cooldownKey !== undefined) {
      const last = this.lastSpokenByKey.get(request.cooldownKey);
      if (last !== undefined && now - last < this.cooldownMs) return false;
    }

    if (this.current?.text === request.text || this.queue.some((q) => q.text === request.text)) {
      return false;
    }

    const item: QueuedItem = { ...request, enqueuedAt: now, seq: this.seq++ };
    if (request.cooldownKey !== undefined) this.lastSpokenByKey.set(request.cooldownKey, now);

    if (this.current && request.priority < this.current.priority) {
      // Ưu tiên cao hơn → ngắt câu đang đọc
      this.insert(item);
      this.interruptCurrent();
      return true;
    }

    this.insert(item);
    if (!this.current) this.playNext();
    return true;
  }

  /** Dừng toàn bộ (ví dụ khi logout). */
  async clear(): Promise<void> {
    this.queue = [];
    this.current = null;
    this.utteranceToken++;
    this.emitSpeaking(false);
    await this.safeStop();
  }

  /** Dùng cho echo guard: bỏ qua transcript thu được khi TTS đang phát. */
  isSpeaking(): boolean {
    return this.current !== null;
  }

  onSpeakingChange(listener: SpeakingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Lệnh "lặp lại". */
  getLastText(): string | null {
    return this.lastText;
  }

  private insert(item: QueuedItem): void {
    this.queue.push(item);
    this.queue.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
  }

  private interruptCurrent(): void {
    this.current = null;
    this.utteranceToken++; // callback của utterance cũ sẽ bị bỏ qua
    void this.safeStop().then(() => {
      if (!this.current) this.playNext();
    });
  }

  private playNext(): void {
    const now = this.now();
    let next = this.queue.shift();
    while (next && next.maxAgeMs !== undefined && now - next.enqueuedAt > next.maxAgeMs) {
      next = this.queue.shift();
    }

    if (!next) {
      this.current = null;
      this.emitSpeaking(false);
      return;
    }

    this.current = next;
    this.lastText = next.text;
    const token = ++this.utteranceToken;
    this.emitSpeaking(true);

    const finish = () => {
      if (token !== this.utteranceToken) return;
      this.current = null;
      this.playNext();
    };

    try {
      this.engine.speak(next.text, {
        language: this.settings.language,
        rate: this.settings.rate,
        volume: this.settings.volume,
        voice: this.settings.voice,
        onDone: finish,
        onStopped: finish,
        onError: (error) => {
          logger.warn('TTS error', error.message);
          finish();
        },
      });
    } catch (error) {
      logger.error('TTS speak failed', error);
      finish();
    }
  }

  private async safeStop(): Promise<void> {
    try {
      await this.engine.stop();
    } catch (error) {
      logger.warn('TTS stop failed', error);
    }
  }

  private emitSpeaking(speaking: boolean): void {
    this.listeners.forEach((l) => l(speaking));
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const ttsService = new TtsService();
