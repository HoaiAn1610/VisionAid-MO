import { ApiError } from '@/api/client';
import type { EmergencyContact } from '@/api/endpoints/emergency';
import { Strings } from '@/constants/strings.vi';

import { createFallAlert, type FallAlertDeps, type FallAlertState } from './fallAlert';

const mom: EmergencyContact = {
  id: '1',
  contactName: 'Mẹ',
  contactType: 'Phone',
  phoneNumber: '0901234567',
  zaloDeepLink: null,
  priorityOrder: 1,
};
const fall = { impactAt: Date.parse('2026-10-06T10:00:00Z'), accelerometerData: '{"peakG":3}' };

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function setup(over: Partial<FallAlertDeps> = {}) {
  const states: FallAlertState[] = [];
  const deps: FallAlertDeps = {
    isOnline: () => true,
    position: jest.fn(async () => ({ latitude: 10.7, longitude: 106.7 })),
    createEvent: jest.fn(async () => ({ id: 'ev-1' })),
    dismissEvent: jest.fn(async () => {}),
    enqueue: jest.fn(async () => {}),
    contacts: jest.fn(async () => [mom]),
    call: jest.fn(async () => {}),
    say: jest.fn(),
    tick: jest.fn(),
    sentHaptic: jest.fn(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    now: () => Date.parse('2026-10-06T10:00:06Z'), // đủ 2 tín hiệu 6 s sau va chạm
    newId: () => 'fall-1',
    captureSnapshot: jest.fn(async () => 'IMG'),
    uploadSnapshot: jest.fn(async () => undefined),
    detectedMessage: () => Strings.fall.detected,
    ...over,
  };
  const alert = createFallAlert(deps, (s) => states.push(s));
  return { alert, deps, states };
}

/** Chạy hết đồng hồ đếm ngược và các promise phía sau. */
async function runCountdown() {
  for (let i = 0; i < 16; i++) await jest.advanceTimersByTimeAsync(1000);
}

describe('createFallAlert', () => {
  it('online: tạo event với detectedAt = lúc đủ 2 tín hiệu (khớp grace của server), rung mỗi giây', async () => {
    const { alert, deps } = setup();
    await alert.start(fall);
    expect(deps.say).toHaveBeenCalledWith(Strings.fall.detected);
    expect(deps.createEvent).toHaveBeenCalledWith({
      clientEventId: 'fall-1',
      detectionMethod: 'AccelerometerCamera',
      detectedAt: '2026-10-06T10:00:06.000Z',
      accelerometerData: '{"peakG":3}',
      latitude: 10.7,
      longitude: 106.7,
    });
    await runCountdown();
    expect(deps.tick).toHaveBeenCalledTimes(15);
    expect(deps.say).toHaveBeenCalledWith('5');
    expect(deps.say).not.toHaveBeenCalledWith('14'); // chừa khoảng lặng cho mic
    expect(deps.say).not.toHaveBeenCalledWith('3');
    expect(deps.say).toHaveBeenLastCalledWith(Strings.fall.sent);
    expect(alert.getState().phase).toBe('sent');
    expect(deps.enqueue).not.toHaveBeenCalled(); // server tự gửi khi hết grace
    expect(deps.call).not.toHaveBeenCalled();
  });

  it('ảnh hiện trường: chụp lúc té ngã, chỉ gửi khi cảnh báo được gửi đi', async () => {
    const { alert, deps } = setup();
    await alert.start(fall);
    expect(deps.captureSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.uploadSnapshot).not.toHaveBeenCalled(); // còn đang đếm ngược
    await runCountdown();
    expect(deps.uploadSnapshot).toHaveBeenCalledWith('ev-1', 'IMG');
  });

  it('người dùng hủy → KHÔNG BAO GIỜ gửi ảnh (riêng tư)', async () => {
    const { alert, deps } = setup();
    await alert.start(fall);
    await alert.cancel();
    await runCountdown();
    expect(deps.uploadSnapshot).not.toHaveBeenCalled();
  });

  it('offline → ảnh đi kèm (inline) cảnh báo trong hàng đợi', async () => {
    const { alert, deps } = setup({ isOnline: () => false });
    await alert.start(fall);
    await runCountdown();
    expect(deps.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ snapshotBase64: 'IMG', snapshotContentType: 'image/jpeg' }),
    );
    expect(deps.uploadSnapshot).not.toHaveBeenCalled();
  });

  it('hủy trong 15 s → dismiss event, báo đã hủy, dừng đếm', async () => {
    const { alert, deps } = setup();
    await alert.start(fall);
    await jest.advanceTimersByTimeAsync(4000);
    await alert.cancel();
    expect(deps.dismissEvent).toHaveBeenCalledWith('ev-1');
    expect(deps.say).toHaveBeenLastCalledWith(Strings.fall.cancelled);
    await runCountdown();
    expect(alert.getState().phase).toBe('cancelled');
    expect(deps.sentHaptic).not.toHaveBeenCalled();
  });

  it('hủy trong lúc đang lấy GPS → KHÔNG tạo event (Caregiver không nhận cảnh báo giả)', async () => {
    let resolvePosition: (p: null) => void = () => undefined;
    const { alert, deps } = setup({
      position: jest.fn(() => new Promise<null>((r) => (resolvePosition = r))),
    });
    const started = alert.start(fall);
    await alert.cancel();
    resolvePosition(null);
    await started;
    await runCountdown();
    expect(deps.createEvent).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
    expect(deps.say).toHaveBeenLastCalledWith(Strings.fall.cancelled);
  });

  it('reset cho lần té ngã mới khi lần cũ đang lấy GPS → lần cũ không ghi đè payload', async () => {
    let resolveFirst: (p: null) => void = () => undefined;
    const position = jest
      .fn()
      .mockImplementationOnce(() => new Promise<null>((r) => (resolveFirst = r)))
      .mockResolvedValue({ latitude: 1, longitude: 2 });
    const { alert, deps } = setup({ position });
    const first = alert.start({ ...fall, accelerometerData: 'old' });
    await alert.cancel();
    alert.reset();
    await alert.start({ ...fall, accelerometerData: 'new' });
    resolveFirst(null);
    await first;
    expect(deps.createEvent).toHaveBeenCalledTimes(1);
    expect(deps.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ accelerometerData: 'new' }),
    );
  });

  it('GPS treo quá 15 giây → vẫn đưa event (không vị trí) vào hàng đợi, không tạo trùng', async () => {
    let resolvePosition: (p: { latitude: number; longitude: number }) => void = () => undefined;
    const { alert, deps } = setup({
      position: jest.fn(() => new Promise((r) => (resolvePosition = r))),
    });
    const started = alert.start(fall);
    await runCountdown();
    expect(deps.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ detectionMethod: 'AccelerometerCamera', latitude: null }),
    );
    resolvePosition({ latitude: 1, longitude: 2 });
    await started;
    expect(deps.createEvent).not.toHaveBeenCalled();
    expect(deps.enqueue).toHaveBeenCalledTimes(1);
  });

  it('server đã quá grace (422) → báo cảnh báo đã gửi', async () => {
    const { alert, deps } = setup({
      dismissEvent: jest.fn(async () => {
        throw new ApiError(422, 'Business Rule Violation', 'Grace period has expired');
      }),
    });
    await alert.start(fall);
    await alert.cancel();
    expect(deps.say).toHaveBeenLastCalledWith(Strings.fall.alreadySent);
  });

  it('offline: hết 15 s không hủy → vào hàng đợi + gọi người thân', async () => {
    const { alert, deps } = setup({ isOnline: () => false });
    await alert.start(fall);
    expect(deps.createEvent).not.toHaveBeenCalled();
    await runCountdown();
    expect(deps.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ detectionMethod: 'AccelerometerCamera' }),
    );
    expect(deps.call).toHaveBeenCalledWith(expect.objectContaining({ kind: 'call' }));
    expect(deps.say).toHaveBeenLastCalledWith(
      `${Strings.fall.queued} ${Strings.emergency.calling('Mẹ')}`,
    );
  });

  it('offline và người dùng hủy → không gửi gì, không gọi ai', async () => {
    const { alert, deps } = setup({ isOnline: () => false });
    await alert.start(fall);
    await alert.cancel();
    await runCountdown();
    expect(deps.enqueue).not.toHaveBeenCalled();
    expect(deps.call).not.toHaveBeenCalled();
    expect(deps.say).toHaveBeenLastCalledWith(Strings.fall.cancelled);
  });

  it('tạo event lỗi khi online → xử lý như offline lúc hết giờ', async () => {
    const { alert, deps } = setup({
      createEvent: jest.fn(async () => {
        throw new Error('500');
      }),
    });
    await alert.start(fall);
    await runCountdown();
    expect(deps.enqueue).toHaveBeenCalled();
    expect(deps.call).toHaveBeenCalled();
  });
});
