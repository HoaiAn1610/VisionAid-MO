import type { TtsPreferences } from '@/api/endpoints/users';
import { BusinessRules } from '@/constants/businessRules';
import { logger } from '@/utils/logger';

export const DEFAULT_PREFERENCES: TtsPreferences = {
  speedRate: 1,
  volumeLevel: 1,
  detectionMode: 'Full',
};

/** Bản lưu trên máy: gắn userId (đổi tài khoản không dùng nhầm), `dirty` = chưa đẩy được lên server. */
interface Cached {
  userId: string;
  prefs: TtsPreferences;
  dirty: boolean;
}

export interface PreferencesDeps {
  userId(): string | null;
  readCache(): Promise<string | null>;
  writeCache(json: string): Promise<void>;
  fetchRemote(): Promise<TtsPreferences | null>;
  pushRemote(p: TtsPreferences): Promise<void>;
  /** Áp dụng vào TTS + chế độ dẫn đường ngay lập tức. */
  apply(p: TtsPreferences): void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
/** Làm tròn 2 chữ số: 0.1 + 0.2 không thành 0.30000000000000004 khi lưu / đọc lên. */
const round2 = (v: number) => Math.round(v * 100) / 100;

export function normalizePreferences(p: TtsPreferences): TtsPreferences {
  return {
    speedRate: round2(clamp(p.speedRate, BusinessRules.TTS_MIN_SPEED, BusinessRules.TTS_MAX_SPEED)),
    volumeLevel: round2(
      clamp(p.volumeLevel, BusinessRules.TTS_MIN_VOLUME, BusinessRules.TTS_MAX_VOLUME),
    ),
    detectionMode: p.detectionMode,
  };
}

/**
 * Tùy chọn đọc / chế độ (§9.9): áp dụng ngay, lưu trên máy để mở app offline vẫn đúng, đồng bộ
 * `/users/me/tts-preferences`. Đổi khi offline → lưu `dirty`, lần mở app sau đẩy lên server
 * (không bị bản cũ trên server ghi đè).
 */
export function createPreferences(deps: PreferencesDeps) {
  let current: TtsPreferences = DEFAULT_PREFERENCES;
  /** Tăng mỗi lần người dùng đổi — bản server tải về muộn không được ghi đè thay đổi mới hơn. */
  let version = 0;

  const save = async (prefs: TtsPreferences, dirty: boolean) => {
    const userId = deps.userId();
    if (!userId) return;
    const cached: Cached = { userId, prefs, dirty };
    await deps
      .writeCache(JSON.stringify(cached))
      .catch((e: unknown) => logger.warn('Cache preferences failed', e));
  };

  const readCached = async (): Promise<Cached | null> => {
    try {
      const raw = await deps.readCache();
      if (!raw) return null;
      const cached = JSON.parse(raw) as Cached;
      return cached.userId === deps.userId() ? cached : null;
    } catch {
      return null;
    }
  };

  const setCurrent = (p: TtsPreferences) => {
    current = normalizePreferences(p);
    deps.apply(current);
  };

  return {
    get: (): TtsPreferences => current,

    /** Gọi khi vào app sau đăng nhập. */
    async load(): Promise<void> {
      const cached = await readCached();
      setCurrent(cached?.prefs ?? DEFAULT_PREFERENCES);
      try {
        if (cached?.dirty) {
          await deps.pushRemote(current); // thay đổi lúc offline thắng bản trên server
          await save(current, false);
          return;
        }
        const startedAt = version;
        const remote = await deps.fetchRemote();
        if (version !== startedAt) return; // người dùng vừa đổi trong lúc tải → giữ thay đổi đó
        if (remote) {
          setCurrent(remote);
          await save(current, false);
        }
      } catch (e) {
        logger.warn('Sync preferences failed, using local', e);
      }
    },

    /** Đổi một phần tùy chọn. Trả `'saved'` nếu đã lên server, `'local'` nếu chỉ lưu trên máy. */
    async update(patch: Partial<TtsPreferences>): Promise<'saved' | 'local'> {
      version++;
      setCurrent({ ...current, ...patch });
      await save(current, true);
      try {
        await deps.pushRemote(current);
        await save(current, false);
        return 'saved';
      } catch (e) {
        logger.warn('Push preferences failed, kept locally', e);
        return 'local';
      }
    },
  };
}

export type Preferences = ReturnType<typeof createPreferences>;
