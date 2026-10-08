export interface FrameWatchdogOptions {
  /** Đã có khung hình rồi mà quá lâu không có khung mới → coi là camera ngừng. */
  stallMs: number;
  /** Lúc mới bắt đầu (camera + model khởi động) cho thời gian dài hơn. */
  firstFrameMs: number;
  checkEveryMs: number;
  now(): number;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  onStall(): void;
  onRecover(): void;
}

/**
 * Canh camera dẫn đường: YOLO dừng im lặng (camera lỗi, bị app khác chiếm, frame processor treo) là
 * nguy hiểm — người khiếm thị tưởng vẫn được cảnh báo. Báo một lần khi ngừng, một lần khi có lại.
 */
export function createFrameWatchdog(o: FrameWatchdogOptions) {
  let timer: unknown = null;
  let lastFrameAt = 0;
  let seenFrame = false;
  let stalled = false;

  const check = () => {
    const limit = seenFrame ? o.stallMs : o.firstFrameMs;
    if (!stalled && o.now() - lastFrameAt > limit) {
      stalled = true;
      o.onStall();
    }
  };

  return {
    start(): void {
      if (timer !== null) return;
      lastFrameAt = o.now();
      seenFrame = false;
      stalled = false;
      timer = o.setInterval(check, o.checkEveryMs);
    },
    stop(): void {
      if (timer !== null) o.clearInterval(timer);
      timer = null;
      stalled = false;
    },
    frame(): void {
      lastFrameAt = o.now();
      seenFrame = true;
      if (stalled) {
        stalled = false;
        o.onRecover();
      }
    },
  };
}

export type FrameWatchdog = ReturnType<typeof createFrameWatchdog>;
