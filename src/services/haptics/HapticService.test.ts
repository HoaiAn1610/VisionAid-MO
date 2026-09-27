import * as Haptics from 'expo-haptics';

import { HapticService } from './HapticService';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

const haptics = Haptics as jest.Mocked<typeof Haptics>;

describe('HapticService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('máy không hỗ trợ rung → không ném lỗi (không làm crash luồng khẩn cấp)', async () => {
    haptics.impactAsync.mockRejectedValue(new Error('not supported'));
    haptics.notificationAsync.mockRejectedValue(new Error('not supported'));
    await expect(HapticService.tap()).resolves.toBeUndefined();
    await expect(HapticService.countdownTick()).resolves.toBeUndefined();
    await expect(HapticService.sosSent()).resolves.toBeUndefined();
  });

  it('SOS đã gửi = 3 lần rung Error (pattern riêng)', async () => {
    jest.useFakeTimers();
    haptics.notificationAsync.mockResolvedValue();
    const done = HapticService.sosSent();
    await jest.runAllTimersAsync();
    await done;
    expect(haptics.notificationAsync).toHaveBeenCalledTimes(3);
    expect(haptics.notificationAsync).toHaveBeenCalledWith('error');
    jest.useRealTimers();
  });
});
