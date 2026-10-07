import { PermissionsAndroid } from 'react-native';

import { openDialer, placeCall } from '../../../modules/phone-call';

import { executeCall } from './callContact';
import type { CallPlan } from './callPlan';

jest.mock('../../../modules/phone-call', () => ({ placeCall: jest.fn(), openDialer: jest.fn() }));
jest.mock('@/services/tts/TtsService', () => ({
  TtsPriority: { FEEDBACK: 3 },
  ttsService: { enqueue: jest.fn() },
}));

const plan: CallPlan = {
  kind: 'call',
  number: '0901234567',
  contact: {
    id: '1',
    contactName: 'Mẹ',
    contactType: 'Phone',
    phoneNumber: '0901234567',
    zaloDeepLink: null,
    priorityOrder: 1,
  },
};

beforeEach(() => jest.clearAllMocks());

describe('executeCall', () => {
  it('chưa có quyền → mở trình quay số, KHÔNG hiện hộp thoại xin quyền giữa lúc khẩn cấp', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    const request = jest.spyOn(PermissionsAndroid, 'request');
    await executeCall(plan);
    expect(request).not.toHaveBeenCalled();
    expect(placeCall).not.toHaveBeenCalled();
    expect(openDialer).toHaveBeenCalledWith('0901234567');
  });

  it('có quyền → tự quay; native lỗi → vẫn mở trình quay số', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    (placeCall as jest.Mock).mockImplementationOnce(() => {
      throw new Error('SecurityException');
    });
    await executeCall(plan);
    expect(placeCall).toHaveBeenCalledWith('0901234567');
    expect(openDialer).toHaveBeenCalledWith('0901234567');
  });
});
