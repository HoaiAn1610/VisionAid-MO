import { createFrameWatchdog } from './frameWatchdog';

jest.useFakeTimers();

function setup() {
  const onStall = jest.fn();
  const onRecover = jest.fn();
  const w = createFrameWatchdog({
    stallMs: 4000,
    firstFrameMs: 15000,
    checkEveryMs: 1000,
    now: Date.now,
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
    onStall,
    onRecover,
  });
  return { w, onStall, onRecover };
}

describe('frameWatchdog', () => {
  it('khung hình đều → không báo', () => {
    const { w, onStall } = setup();
    w.start();
    for (let i = 0; i < 20; i++) {
      jest.advanceTimersByTime(1000);
      w.frame();
    }
    expect(onStall).not.toHaveBeenCalled();
  });

  it('camera ngừng giữa chừng → báo MỘT lần; có hình lại → báo phục hồi', () => {
    const { w, onStall, onRecover } = setup();
    w.start();
    w.frame();
    jest.advanceTimersByTime(10_000);
    expect(onStall).toHaveBeenCalledTimes(1);
    w.frame();
    expect(onRecover).toHaveBeenCalledTimes(1);
    w.frame();
    expect(onRecover).toHaveBeenCalledTimes(1);
  });

  it('lúc khởi động cho tới 15 s mới coi là ngừng', () => {
    const { w, onStall } = setup();
    w.start();
    jest.advanceTimersByTime(12_000);
    expect(onStall).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5_000);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it('dừng canh (chạy nền / cuộc gọi giữ camera) → không báo', () => {
    const { w, onStall } = setup();
    w.start();
    w.frame();
    w.stop();
    jest.advanceTimersByTime(60_000);
    expect(onStall).not.toHaveBeenCalled();
  });
});
