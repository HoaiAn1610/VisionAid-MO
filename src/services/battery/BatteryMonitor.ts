import * as Battery from 'expo-battery';

import { logger } from '@/utils/logger';

import { crossedLowBattery } from './lowBattery';

/**
 * Theo dõi pin (FE-14, BR-17): xuống dưới ngưỡng → gọi `onLow` một lần. Đọc mức hiện tại khi bắt
 * đầu (mở app lúc pin đã yếu cũng báo). Trả hàm dừng.
 */
export function startBatteryMonitor(onLow: () => void): () => void {
  let low = false;
  const handle = (level: number) => {
    const next = crossedLowBattery(low, level);
    low = next.low;
    if (next.enter) onLow();
  };
  Battery.getBatteryLevelAsync()
    .then(handle)
    .catch((e: unknown) => logger.warn('Read battery failed', e));
  const sub = Battery.addBatteryLevelListener(({ batteryLevel }) => handle(batteryLevel));
  return () => sub.remove();
}
