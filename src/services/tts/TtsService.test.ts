import type * as Speech from 'expo-speech';

import { TtsPriority, TtsService, type SpeechEngine } from './TtsService';

class FakeEngine implements SpeechEngine {
  spoken: string[] = [];
  private active: Speech.SpeechOptions | null = null;

  speak(text: string, options: Speech.SpeechOptions): void {
    this.spoken.push(text);
    this.active = options;
  }

  async stop(): Promise<void> {
    const active = this.active;
    this.active = null;
    active?.onStopped?.();
  }

  finish(): void {
    const active = this.active;
    this.active = null;
    active?.onDone?.();
  }
}

const flush = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

describe('TtsService', () => {
  let engine: FakeEngine;
  let now: number;
  let tts: TtsService;

  beforeEach(() => {
    engine = new FakeEngine();
    now = 0;
    tts = new TtsService(engine, () => now);
  });

  it('phát theo thứ tự priority', () => {
    tts.enqueue({ text: 'a', priority: TtsPriority.SYSTEM });
    tts.enqueue({ text: 'info', priority: TtsPriority.INFO });
    tts.enqueue({ text: 'feedback', priority: TtsPriority.FEEDBACK });
    engine.finish();
    engine.finish();
    expect(engine.spoken).toEqual(['a', 'feedback', 'info']);
  });

  it('priority cao hơn ngắt câu đang đọc', async () => {
    tts.enqueue({ text: 'thông tin', priority: TtsPriority.INFO });
    tts.enqueue({ text: 'xe máy ở gần', priority: TtsPriority.DANGER });
    await flush();
    expect(engine.spoken).toEqual(['thông tin', 'xe máy ở gần']);
  });

  it('priority thấp hơn không ngắt', () => {
    tts.enqueue({ text: 'nguy hiểm', priority: TtsPriority.DANGER });
    tts.enqueue({ text: 'thông tin', priority: TtsPriority.INFO });
    expect(engine.spoken).toEqual(['nguy hiểm']);
  });

  it('áp dụng cooldown theo cooldownKey', () => {
    expect(
      tts.enqueue({ text: 'Ô tô ở gần', priority: TtsPriority.DANGER, cooldownKey: 'car' }),
    ).toBe(true);
    engine.finish();
    now = 2000;
    expect(
      tts.enqueue({ text: 'Ô tô phía trước', priority: TtsPriority.DANGER, cooldownKey: 'car' }),
    ).toBe(false);
    now = 3000;
    expect(
      tts.enqueue({ text: 'Ô tô phía trước', priority: TtsPriority.DANGER, cooldownKey: 'car' }),
    ).toBe(true);
  });

  it('trong cooldown: mức khẩn CAO hơn lần trước → vẫn đọc; bằng hoặc thấp hơn → chặn', () => {
    const car = (text: string, urgency: number) =>
      tts.enqueue({ text, priority: TtsPriority.DANGER, cooldownKey: 'car', urgency });
    expect(car('Ô tô ở xa', 0)).toBe(true);
    engine.finish();
    now = 500;
    expect(car('Ô tô ở gần', 2)).toBe(true); // tiến lại gần → không được im lặng
    engine.finish();
    now = 1000;
    expect(car('Ô tô phía trước', 1)).toBe(false); // lùi ra xa trong cooldown → chặn
    expect(car('Ô tô ở gần', 2)).toBe(false); // cùng mức, cooldown tính lại từ 500
  });

  it('EMERGENCY bỏ qua cooldown', () => {
    tts.enqueue({ text: '15', priority: TtsPriority.EMERGENCY, cooldownKey: 'fall' });
    engine.finish();
    now = 1000;
    expect(tts.enqueue({ text: '14', priority: TtsPriority.EMERGENCY, cooldownKey: 'fall' })).toBe(
      true,
    );
  });

  it('không enqueue trùng nội dung', () => {
    tts.enqueue({ text: 'x', priority: TtsPriority.INFO });
    expect(tts.enqueue({ text: 'x', priority: TtsPriority.INFO })).toBe(false);
  });

  it('drop item quá maxAgeMs', () => {
    tts.enqueue({ text: 'đang đọc', priority: TtsPriority.FEEDBACK });
    tts.enqueue({ text: 'cũ', priority: TtsPriority.INFO, maxAgeMs: 500 });
    now = 1000;
    engine.finish();
    expect(engine.spoken).toEqual(['đang đọc']);
    expect(tts.isSpeaking()).toBe(false);
  });

  it('báo trạng thái đang phát cho echo guard', () => {
    const states: boolean[] = [];
    tts.onSpeakingChange((s) => states.push(s));
    tts.enqueue({ text: 'a', priority: TtsPriority.INFO });
    expect(tts.isSpeaking()).toBe(true);
    engine.finish();
    expect(tts.isSpeaking()).toBe(false);
    expect(states).toEqual([true, false]);
  });

  it('clamp tốc độ và âm lượng', () => {
    tts.updateSettings({ rate: 5, volume: -1 });
    expect(tts.getSettings()).toMatchObject({ rate: 2.0, volume: 0 });
  });

  it('nhớ câu gần nhất cho lệnh "lặp lại"', () => {
    tts.enqueue({ text: 'xin chào', priority: TtsPriority.INFO });
    expect(tts.getLastText()).toBe('xin chào');
  });
});
