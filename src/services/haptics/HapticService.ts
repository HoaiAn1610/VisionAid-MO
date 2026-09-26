import * as Haptics from 'expo-haptics';

import { logger } from '@/utils/logger';

async function safe(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    logger.warn('Haptic failed', error);
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const HapticService = {
  /** Xác nhận thao tác thông thường. */
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Nhịp đếm ngược té ngã — gọi mỗi giây. */
  countdownTick: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** Pattern riêng khi SOS đã gửi: 3 rung mạnh. */
  sosSent: () =>
    safe(async () => {
      for (let i = 0; i < 3; i++) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        await wait(250);
      }
    }),
};
