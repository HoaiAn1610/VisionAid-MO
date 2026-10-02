import { normalizeText, readText, SLOW_NOTICE_MS, type ReadTextDeps } from './readText';

const image = { uri: 'file:///tmp/a.jpg', name: 'photo.jpg', type: 'image/jpeg' as const };

const deps = (over: Partial<ReadTextDeps> = {}): ReadTextDeps => ({
  isOnline: () => true,
  recognizeOnServer: jest.fn(async () => 'Nhà thuốc Long Châu'),
  recognizeOnDevice: jest.fn(async () => 'Nha thuoc'),
  logOnDevice: jest.fn(),
  onSlow: jest.fn(),
  now: () => 1_000,
  ...over,
});

describe('readText', () => {
  it('online + server có chữ → đọc kết quả server, không chạy ML Kit, không log thêm', async () => {
    const d = deps();
    await expect(readText(image, 'Tap', d)).resolves.toEqual({
      text: 'Nhà thuốc Long Châu',
      source: 'server',
    });
    expect(d.recognizeOnDevice).not.toHaveBeenCalled();
    expect(d.logOnDevice).not.toHaveBeenCalled();
  });

  it.each<[string, () => Promise<string | null>]>([
    ['server trả null (VietOCR lỗi)', async () => null],
    ['server không ra chữ', async () => '   '],
    [
      'server lỗi / timeout',
      async () => {
        throw new Error('timeout');
      },
    ],
  ])('%s → fallback ML Kit + log vào hàng đợi', async (_, server) => {
    const d = deps({ recognizeOnServer: jest.fn(server) });
    await expect(readText(image, 'VoiceCommand', d)).resolves.toEqual({
      text: 'Nha thuoc',
      source: 'device',
    });
    expect(d.logOnDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        processedText: 'Nha thuoc',
        ocrEngine: 'MLKit',
        triggerMethod: 'VoiceCommand',
        resultStatus: 'Success',
      }),
    );
  });

  it('offline → không gọi server', async () => {
    const d = deps({ isOnline: () => false });
    await readText(image, 'Tap', d);
    expect(d.recognizeOnServer).not.toHaveBeenCalled();
    expect(d.recognizeOnDevice).toHaveBeenCalledWith(image.uri);
  });

  it('cả hai không ra chữ → text null (BR-24), log Failed', async () => {
    const d = deps({
      isOnline: () => false,
      recognizeOnDevice: jest.fn(async () => {
        throw new Error('mlkit');
      }),
    });
    await expect(readText(image, 'Tap', d)).resolves.toEqual({ text: null, source: 'device' });
    expect(d.logOnDevice).toHaveBeenCalledWith(
      expect.objectContaining({ processedText: null, resultStatus: 'Failed' }),
    );
  });

  it('chậm hơn 1.5s → báo "Đang đọc" đúng một lần; nhanh → không báo', async () => {
    jest.useFakeTimers();
    try {
      let resolve: (t: string) => void = () => undefined;
      const d = deps({
        recognizeOnServer: jest.fn(() => new Promise<string>((r) => (resolve = r))),
      });
      const pending = readText(image, 'Tap', d);
      jest.advanceTimersByTime(SLOW_NOTICE_MS);
      resolve('chữ');
      await pending;
      expect(d.onSlow).toHaveBeenCalledTimes(1);

      const fast = deps();
      await readText(image, 'Tap', fast);
      jest.advanceTimersByTime(SLOW_NOTICE_MS);
      expect(fast.onSlow).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('normalizeText', () => {
  it('gộp xuống dòng, rỗng → null', () => {
    expect(normalizeText('Dòng 1\n  Dòng 2 ')).toBe('Dòng 1 Dòng 2');
    expect(normalizeText('\n ')).toBeNull();
    expect(normalizeText(null)).toBeNull();
  });
});
