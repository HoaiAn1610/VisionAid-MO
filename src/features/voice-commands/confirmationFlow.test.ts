import { startConfirmation } from './confirmationFlow';

jest.mock('@/services/tts/TtsService', () => ({
  TtsPriority: { EMERGENCY: 0, DANGER: 1, SYSTEM: 2, FEEDBACK: 3, INFO: 4 },
  ttsService: {},
}));

/** TTS giả: đang "đọc" cho tới khi gọi finishSpeaking(). */
function fakeTts() {
  let speaking = false;
  const listeners = new Set<(s: boolean) => void>();
  const spoken: string[] = [];
  return {
    spoken,
    enqueue: jest.fn(({ text }: { text: string }) => {
      spoken.push(text);
      speaking = true;
      listeners.forEach((l) => l(true));
      return true;
    }),
    isSpeaking: () => speaking,
    onSpeakingChange: (l: (s: boolean) => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    finishSpeaking: () => {
      speaking = false;
      listeners.forEach((l) => l(false));
    },
  };
}

const say = (transcript: string) => [{ transcript }];

let tts: ReturnType<typeof fakeTts>;
const start = () =>
  startConfirmation({ prompt: 'Nói có để xác nhận', cancelledMessage: 'Đã hủy', tts });

beforeEach(() => {
  jest.useFakeTimers();
  tts = fakeTts();
});
afterEach(() => jest.useRealTimers());

describe('startConfirmation (BR-14)', () => {
  it('đọc câu hỏi với ưu tiên EMERGENCY', () => {
    start();
    expect(tts.enqueue).toHaveBeenCalledWith({ text: 'Nói có để xác nhận', priority: 0 });
  });

  it('nói "có" sau khi TTS đọc xong → Confirmed kèm confirmedAt', async () => {
    const flow = start();
    tts.finishSpeaking();
    flow.hear(say('có'));
    await expect(flow.result).resolves.toEqual({
      status: 'Confirmed',
      confirmedAt: expect.any(String),
    });
  });

  it('chống tự nghe: câu nghe được khi TTS còn đọc câu hỏi (có chữ "có") bị bỏ qua', async () => {
    const flow = start();
    flow.hear(say('có')); // mic thu lại tiếng loa
    tts.finishSpeaking();
    jest.advanceTimersByTime(10_000);
    await expect(flow.result).resolves.toEqual({ status: 'Cancelled' });
  });

  it('hết 10 s không xác nhận → Cancelled + TTS báo đã hủy', async () => {
    const flow = start();
    tts.finishSpeaking();
    jest.advanceTimersByTime(9_999);
    flow.hear(say('hôm nay trời đẹp')); // tạp âm → chờ tiếp
    jest.advanceTimersByTime(1);
    await expect(flow.result).resolves.toEqual({ status: 'Cancelled' });
    expect(tts.spoken).toContain('Đã hủy');
  });

  it('10 s tính từ khi đọc XONG câu hỏi, không tính lúc đang đọc', async () => {
    const flow = start();
    jest.advanceTimersByTime(4_000); // câu hỏi đọc mất 4 s
    tts.finishSpeaking();
    jest.advanceTimersByTime(9_000);
    flow.hear(say('đồng ý'));
    await expect(flow.result).resolves.toMatchObject({ status: 'Confirmed' });
  });

  it.each(['không', 'không có', 'hủy đi', 'thôi'])('"%s" → hủy ngay', async (text) => {
    const flow = start();
    tts.finishSpeaking();
    flow.hear(say(text));
    await expect(flow.result).resolves.toEqual({ status: 'Cancelled' });
  });

  it('"cô" (dễ nhầm với "có") → không xác nhận, chờ tiếp', async () => {
    const flow = start();
    tts.finishSpeaking();
    flow.hear(say('cô'));
    flow.hear(say('xác nhận'));
    await expect(flow.result).resolves.toMatchObject({ status: 'Confirmed' });
  });

  it('cancel() từ bên ngoài → Cancelled; kết quả chỉ chốt một lần', async () => {
    const flow = start();
    tts.finishSpeaking();
    flow.cancel();
    flow.hear(say('có'));
    jest.advanceTimersByTime(10_000);
    await expect(flow.result).resolves.toEqual({ status: 'Cancelled' });
    expect(tts.spoken.filter((t) => t === 'Đã hủy')).toHaveLength(1);
  });
});
