import { matchIntent } from '@/features/voice-commands/intentMatcher';

import { createEchoGuard } from './echoGuard';

jest.mock('@/services/tts/TtsService', () => ({ ttsService: {} }));

let t = 0;
let speaking = false;
const listeners = new Set<(s: boolean) => void>();
const tts = {
  isSpeaking: () => speaking,
  onSpeakingChange: (l: (s: boolean) => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
const setSpeaking = (s: boolean) => {
  speaking = s;
  listeners.forEach((l) => l(s));
};
const at = (ms: number) => {
  t = ms;
};

beforeEach(() => {
  t = 0;
  speaking = false;
  listeners.clear();
});

describe('createEchoGuard', () => {
  it('TTS đọc "Nói tôi ổn để hủy" trong lúc mic nghe, kết quả về SAU khi TTS dừng → bỏ', () => {
    const guard = createEchoGuard(tts, () => t);
    at(0);
    guard.markListeningStart();
    at(100);
    setSpeaking(true); // đếm ngược té ngã: "Phát hiện té ngã. Nói 'Tôi ổn'..."
    at(2_500);
    setSpeaking(false);
    at(3_000); // STT trả kết quả "tôi ổn" — chính là tiếng loa
    expect(matchIntent([{ transcript: 'tôi ổn' }])?.intent).toBe('I_AM_OK');
    expect(guard.shouldDiscard()).toBe(true);
  });

  it('TTS đang phát lúc nhận kết quả → bỏ', () => {
    const guard = createEchoGuard(tts, () => t);
    guard.markListeningStart();
    setSpeaking(true);
    expect(guard.shouldDiscard()).toBe(true);
  });

  it('TTS vừa dừng < 500 ms trước khi bắt đầu nghe (còn vang) → bỏ', () => {
    const guard = createEchoGuard(tts, () => t);
    setSpeaking(true);
    at(1_000);
    setSpeaking(false);
    at(1_300);
    guard.markListeningStart();
    at(2_000);
    expect(guard.shouldDiscard()).toBe(true);
  });

  it('người dùng nói "tôi ổn" trong khoảng lặng (TTS đã dừng từ trước) → giữ', () => {
    const guard = createEchoGuard(tts, () => t);
    setSpeaking(true);
    at(1_000);
    setSpeaking(false);
    at(2_000);
    guard.markListeningStart();
    at(3_500);
    expect(guard.shouldDiscard()).toBe(false);
  });

  it('tạo guard khi TTS đang phát → lượt nghe bắt đầu ngay lúc đó vẫn bị bỏ', () => {
    speaking = true;
    const guard = createEchoGuard(tts, () => t);
    guard.markListeningStart();
    speaking = false; // dừng mà không phát sự kiện (engine lỗi)
    expect(guard.shouldDiscard()).toBe(true);
  });

  it('dispose() gỡ listener', () => {
    const guard = createEchoGuard(tts, () => t);
    guard.dispose();
    expect(listeners.size).toBe(0);
  });
});
