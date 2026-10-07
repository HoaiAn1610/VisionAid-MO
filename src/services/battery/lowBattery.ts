import { BusinessRules } from '@/constants/businessRules';

/**
 * BR-17: báo + chuyển Minimal MỘT lần mỗi lần pin xuống dưới ngưỡng. `wasLow` = trạng thái trước;
 * sạc lên lại trên ngưỡng thì lần tụt sau sẽ báo tiếp. Mức pin 0–1; < 0 = máy không đọc được.
 */
export function crossedLowBattery(
  wasLow: boolean,
  level: number,
): { low: boolean; enter: boolean } {
  if (level < 0) return { low: wasLow, enter: false };
  const low = level * 100 < BusinessRules.LOW_BATTERY_THRESHOLD_PERCENT;
  return { low, enter: low && !wasLow };
}
