import { Linking, PermissionsAndroid } from 'react-native';

import { Strings } from '@/constants/strings.vi';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';

import { openDialer, placeCall } from '../../../modules/phone-call';

import type { CallPlan } from './callPlan';

async function canPlaceCalls(): Promise<boolean> {
  const permission = PermissionsAndroid.PERMISSIONS.CALL_PHONE;
  if (await PermissionsAndroid.check(permission)) return true;
  ttsService.enqueue({
    text: Strings.emergency.callPermissionExplain,
    priority: TtsPriority.EMERGENCY,
  });
  return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Thực hiện cách liên lạc đã chọn. Không có quyền gọi điện → vẫn mở trình quay số đã điền sẵn
 * (không bao giờ để SOS kết thúc mà không liên lạc được ai).
 */
export async function executeCall(plan: CallPlan): Promise<void> {
  switch (plan.kind) {
    case 'call':
      if (await canPlaceCalls()) return placeCall(plan.number);
      return openDialer(plan.number);
    case 'dial':
      return openDialer(plan.number);
    case 'zalo':
      return Linking.openURL(plan.url);
    case 'none':
      return;
  }
}
