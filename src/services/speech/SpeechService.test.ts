import { Strings } from '@/constants/strings.vi';

import type { SttResult, SttSession } from './engines';
import {
  createSpeechService,
  OfflineSpeechUnavailableError,
  type SpeechDeps,
} from './SpeechService';
import { SttUnavailableError } from './sttErrors';

jest.mock('./engines', () => ({ recognizeWithGoogle: jest.fn() }));
jest.mock('./onDeviceSpeech', () => ({ isOnDeviceSpeechReady: () => true }));
jest.mock('@/services/network/NetworkMonitor', () => ({ NetworkMonitor: {} }));
jest.mock('@/services/tts/TtsService', () => ({
  TtsPriority: { EMERGENCY: 0, DANGER: 1, SYSTEM: 2, FEEDBACK: 3, INFO: 4 },
  ttsService: {},
}));

const session = (result: Promise<SttResult>): SttSession => ({ promise: result, abort: jest.fn() });
const heard = (transcript: string): Promise<SttResult> =>
  Promise.resolve({ alternatives: [{ transcript }], processingTimeMs: 50 });

let spoken: string[];
let speaking: boolean;
let echo: boolean;
const deps = (over: Partial<SpeechDeps> = {}): SpeechDeps => ({
  google: jest.fn((_phrases: string[], onDevice: boolean) =>
    session(heard(onDevice ? 'dừng lại' : 'bắt đầu')),
  ),
  isOnline: () => true,
  isOfflineReady: () => true,
  tts: {
    enqueue: jest.fn(({ text }: { text: string }) => {
      spoken.push(text);
      return true;
    }),
    isSpeaking: () => speaking,
    onSpeakingChange: () => () => true,
  },
  createGuard: () => ({
    markListeningStart: jest.fn(),
    shouldDiscard: () => echo,
    dispose: jest.fn(),
  }),
  ...over,
});

beforeEach(() => {
  spoken = [];
  speaking = false;
  echo = false;
});

describe('SpeechService', () => {
  it('online → Google online, có danh sách cụm lệnh làm contextualStrings', async () => {
    const d = deps();
    const out = await createSpeechService(d).listenOnce();
    expect(out).toMatchObject({
      engine: 'GoogleSpeech',
      isOffline: false,
      alternatives: [{ transcript: 'bắt đầu' }],
    });
    expect(d.google).toHaveBeenCalledTimes(1);
    expect(d.google).toHaveBeenCalledWith(
      expect.arrayContaining(['bắt đầu', 'gọi khẩn cấp', 'có']),
      false,
    );
  });

  it('offline → Google trên máy + TTS báo dùng nhận dạng ngoại tuyến (BR-16)', async () => {
    const d = deps({ isOnline: () => false });
    const out = await createSpeechService(d).listenOnce();
    expect(out).toMatchObject({ engine: 'GoogleOnDevice', isOffline: true });
    expect(spoken).toContain(Strings.voice.offlineEngine);
    expect(d.google).toHaveBeenCalledWith(expect.any(Array), true);
  });

  it('Google online lỗi mạng / không có dịch vụ → tự chuyển Google trên máy', async () => {
    const d = deps({
      google: jest.fn((_p: string[], onDevice: boolean) =>
        onDevice
          ? session(heard('dừng lại'))
          : session(Promise.reject(new SttUnavailableError('network'))),
      ),
    });
    const svc = createSpeechService(d);
    const out = await svc.listenOnce();
    expect(out.engine).toBe('GoogleOnDevice');
    await svc.listenOnce(); // lỗi lần hai vẫn phải nhắc (trước đây mic mở lại âm thầm)
    expect(spoken).toEqual([Strings.voice.retryOffline, Strings.voice.retryOffline]);
  });

  it('offline mà máy không nhận dạng trên máy được (Android ≤ 12, thiếu vi-VN) → TTS hướng dẫn dùng nút', async () => {
    const svc = createSpeechService(deps({ isOnline: () => false, isOfflineReady: () => false }));
    await expect(svc.listenOnce()).rejects.toBeInstanceOf(OfflineSpeechUnavailableError);
    expect(spoken).toContain(Strings.voice.offlineUnavailable);
  });

  it('Google trên máy cũng lỗi (gói vi-VN bị gỡ…) → TTS hướng dẫn dùng nút', async () => {
    const d = deps({
      isOnline: () => false,
      google: jest.fn(() =>
        session(Promise.reject(new SttUnavailableError('language-not-supported'))),
      ),
    });
    await expect(createSpeechService(d).listenOnce()).rejects.toBeInstanceOf(
      OfflineSpeechUnavailableError,
    );
    expect(spoken).toContain(Strings.voice.offlineUnavailable);
  });

  it('chỉ báo chuyển ngoại tuyến MỘT lần, báo lại sau khi Google đã chạy lại', async () => {
    let online = false;
    const svc = createSpeechService(deps({ isOnline: () => online }));
    await svc.listenOnce();
    await svc.listenOnce();
    expect(spoken.filter((t) => t === Strings.voice.offlineEngine)).toHaveLength(1);
    online = true;
    await svc.listenOnce();
    online = false;
    await svc.listenOnce();
    expect(spoken.filter((t) => t === Strings.voice.offlineEngine)).toHaveLength(2);
  });

  it('kết quả trùng lúc TTS phát → bỏ (echo guard)', async () => {
    echo = true;
    const out = await createSpeechService(deps()).listenOnce();
    expect(out).toMatchObject({ alternatives: [], discardedAsEcho: true });
  });

  it('TTS đang đọc → chờ đọc xong mới mở mic', async () => {
    speaking = true;
    let notify: (s: boolean) => void = () => {};
    const d = deps();
    d.tts.onSpeakingChange = (l) => {
      notify = l;
      return () => true;
    };
    const listening = createSpeechService(d).listenOnce();
    await Promise.resolve();
    expect(d.google).not.toHaveBeenCalled();
    speaking = false;
    notify(false);
    await listening;
    expect(d.google).toHaveBeenCalled();
  });

  it('bấm Hủy trong lúc chờ TTS đọc xong → KHÔNG mở mic', async () => {
    speaking = true;
    let notify: (s: boolean) => void = () => {};
    const d = deps();
    d.tts.onSpeakingChange = (l) => {
      notify = l;
      return () => true;
    };
    const svc = createSpeechService(d);
    const listening = svc.listenOnce();
    await Promise.resolve();
    svc.abort();
    speaking = false;
    notify(false);
    await expect(listening).resolves.toMatchObject({ alternatives: [] });
    expect(d.google).not.toHaveBeenCalled();
  });

  it('lỗi khác (không phải SttUnavailable) → ném ra, không chuyển sang trên máy', async () => {
    const d = deps({ google: jest.fn(() => session(Promise.reject(new Error('boom')))) });
    await expect(createSpeechService(d).listenOnce()).rejects.toThrow('boom');
    expect(d.google).toHaveBeenCalledTimes(1);
  });
});
