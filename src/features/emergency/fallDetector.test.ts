import { createFallDetector, signatureDiff, type FallDetectorConfig } from './fallDetector';

const config: FallDetectorConfig = {
  freeFallG: 0.4,
  impactG: 2.5,
  freeFallToImpactMs: 1000,
  stillMs: 5000,
  maxWaitMs: 15_000,
  stillDiff: 0.03,
};

const flat = Array.from({ length: 64 }, () => 0.5);
const moved = Array.from({ length: 64 }, (_, i) => (i % 2 ? 0.9 : 0.1));

function setup() {
  const onFall = jest.fn();
  const d = createFallDetector(onFall, config);
  const fall = (t: number) => {
    d.onAccel({ x: 0, y: 0.1, z: 0.1, t }); // rơi tự do
    d.onAccel({ x: 2, y: 2, z: 1, t: t + 300 }); // va chạm ~3 g
  };
  /** Gửi khung hình mỗi 333 ms (~3 fps như YOLO) từ `from` tới `to`. */
  const frames = (from: number, to: number, sig: number[] = flat) => {
    for (let t = from; t <= to; t += 333) d.onFrame(sig, t);
  };
  return { d, onFall, fall, frames };
}

describe('createFallDetector (BR-26: cần đủ 2 tín hiệu)', () => {
  it('rơi + va chạm + camera đứng yên 5 s → báo một lần, kèm thời điểm va chạm', () => {
    const { onFall, fall, frames } = setup();
    fall(1000);
    frames(1400, 7500); // khung đầu chưa có khung trước để so → đứng yên tính từ ~1733 ms
    expect(onFall).toHaveBeenCalledTimes(1);
    expect(onFall.mock.calls[0][0].impactAt).toBe(1300);
    expect(JSON.parse(onFall.mock.calls[0][0].accelerometerData).peakG).toBeGreaterThan(2.5);
    frames(7800, 20_000); // đã báo → không báo lặp
    expect(onFall).toHaveBeenCalledTimes(1);
  });

  it('chỉ có camera đứng yên (đặt điện thoại lên bàn) → không báo', () => {
    const { onFall, frames } = setup();
    frames(0, 30_000);
    expect(onFall).not.toHaveBeenCalled();
  });

  it('chỉ có va chạm, sau đó vẫn di chuyển (vấp nhưng đi tiếp) → không báo', () => {
    const { onFall, fall, d } = setup();
    fall(1000);
    for (let t = 1400; t < 30_000; t += 333) d.onFrame(t % 666 < 333 ? flat : moved, t);
    expect(onFall).not.toHaveBeenCalled();
  });

  it('va chạm mạnh nhưng không có pha rơi tự do (đập điện thoại) → không báo', () => {
    const { onFall, d, frames } = setup();
    d.onAccel({ x: 2, y: 2, z: 1, t: 1000 });
    frames(1400, 8000);
    expect(onFall).not.toHaveBeenCalled();
  });

  it('rơi rồi va chạm quá 1 s sau → không tính', () => {
    const { onFall, d, frames } = setup();
    d.onAccel({ x: 0, y: 0, z: 0.1, t: 1000 });
    d.onAccel({ x: 2, y: 2, z: 1, t: 2500 });
    frames(2600, 9000);
    expect(onFall).not.toHaveBeenCalled();
  });

  it('đứng yên bị cắt ngang → đếm lại từ đầu', () => {
    const { onFall, fall, d, frames } = setup();
    fall(1000);
    frames(1400, 4000);
    d.onFrame(moved, 4300); // cử động
    frames(4600, 9000); // chưa đủ 5 s liên tục kể từ 4600
    expect(onFall).not.toHaveBeenCalled();
    frames(9300, 10_000);
    expect(onFall).toHaveBeenCalledTimes(1);
  });
});

describe('signatureDiff', () => {
  it('giống nhau → 0; khác kích thước → 1', () => {
    expect(signatureDiff(flat, flat)).toBe(0);
    expect(signatureDiff(flat, [0.5])).toBe(1);
    expect(signatureDiff(flat, moved)).toBeCloseTo(0.4);
  });
});
