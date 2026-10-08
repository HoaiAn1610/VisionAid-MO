import { useEffect, type RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle, type View } from 'react-native';

import { logger } from '@/utils/logger';

let screenReaderOn = false;
const initial: Promise<boolean> = AccessibilityInfo.isScreenReaderEnabled()
  .then((on) => (screenReaderOn = on))
  .catch((e: unknown) => {
    logger.warn('Read screen reader state failed', e);
    return false;
  });
AccessibilityInfo.addEventListener('screenReaderChanged', (on) => (screenReaderOn = on));

/** TalkBack đang bật — chạm một lần chỉ chọn, phải chạm hai lần; TalkBack tự đọc màn hình. */
export const isScreenReaderOn = (): boolean => screenReaderOn;

/** Như trên nhưng chờ lần đọc đầu tiên (lúc mở app trạng thái chưa có ngay). */
export async function screenReaderEnabled(): Promise<boolean> {
  await initial;
  return screenReaderOn;
}

/**
 * Lớp phủ / sheet vừa hiện → đưa tiêu điểm TalkBack vào đó (Android bỏ qua accessibilityViewIsModal,
 * tiêu điểm sẽ nằm lại ở phần tử bên dưới đã bị ẩn).
 */
export function useAccessibilityFocusOnShow(ref: RefObject<View | null>, visible: boolean): void {
  useEffect(() => {
    const node = visible && ref.current ? findNodeHandle(ref.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [ref, visible]);
}
