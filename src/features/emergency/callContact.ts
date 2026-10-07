import { Linking, PermissionsAndroid } from 'react-native';

import { Strings } from '@/constants/strings.vi';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { logger } from '@/utils/logger';

import { openDialer, placeCall } from '../../../modules/phone-call';

import type { CallPlan } from './callPlan';

const CALL_PHONE = PermissionsAndroid.PERMISSIONS.CALL_PHONE;

/**
 * Xin quyền gọi điện TRƯỚC khi cần (lúc bắt đầu dẫn đường, mở màn khẩn cấp) — giải thích bằng TTS
 * trước hộp thoại (§14). Không bao giờ hỏi giữa lúc khẩn cấp: người bị ngã có thể không bấm được.
 */
export async function ensureCallPermission(): Promise<void> {
  try {
    if (await PermissionsAndroid.check(CALL_PHONE)) return;
    ttsService.enqueue({
      text: Strings.emergency.callPermissionExplain,
      priority: TtsPriority.FEEDBACK,
    });
    await PermissionsAndroid.request(CALL_PHONE);
  } catch (e) {
    logger.warn('Request call permission failed', e);
  }
}

function dialSafely(number: string): void {
  try {
    openDialer(number);
  } catch (e) {
    logger.warn('Open dialer failed', e);
  }
}

/**
 * Thực hiện cách liên lạc đã chọn. Chỉ KIỂM TRA quyền (không hỏi); không có quyền hoặc gọi lỗi →
 * mở trình quay số đã điền sẵn — SOS không bao giờ kết thúc mà không liên lạc được ai.
 */
export async function executeCall(plan: CallPlan): Promise<void> {
  switch (plan.kind) {
    case 'call': {
      const allowed = await PermissionsAndroid.check(CALL_PHONE).catch(() => false);
      if (!allowed) return dialSafely(plan.number);
      try {
        placeCall(plan.number);
      } catch (e) {
        logger.warn('Place call failed, opening dialer', e);
        dialSafely(plan.number);
      }
      return;
    }
    case 'dial':
      return dialSafely(plan.number);
    case 'zalo':
      await Linking.openURL(plan.url).catch((e: unknown) => logger.warn('Open Zalo failed', e));
      return;
    case 'none':
      return;
  }
}
