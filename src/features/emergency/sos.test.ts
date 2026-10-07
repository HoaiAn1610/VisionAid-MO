import type { EmergencyContact } from '@/api/endpoints/emergency';
import { Strings } from '@/constants/strings.vi';

import { sendSos, type SosDeps } from './sos';

const mom: EmergencyContact = {
  id: '1',
  contactName: 'Mẹ',
  contactType: 'Phone',
  phoneNumber: '0901234567',
  zaloDeepLink: null,
  priorityOrder: 1,
};

const deps = (over: Partial<SosDeps> = {}): SosDeps => ({
  isOnline: () => true,
  position: jest.fn(async () => ({ latitude: 10.7, longitude: 106.7 })),
  createEvent: jest.fn(async () => ({ id: 'e1', currentStatus: 'Sent' })),
  enqueue: jest.fn(async () => {}),
  contacts: jest.fn(async () => [mom]),
  announce: jest.fn(async () => {}),
  call: jest.fn(async () => {}),
  now: () => Date.parse('2026-10-06T10:00:00Z'),
  ...over,
});

describe('sendSos', () => {
  it('online: gửi event kèm giờ thiết bị + vị trí, báo đã gửi rồi gọi người ưu tiên 1', async () => {
    const d = deps();
    await expect(sendSos('Manual', d)).resolves.toMatchObject({ sent: true });
    expect(d.createEvent).toHaveBeenCalledWith({
      detectionMethod: 'Manual',
      detectedAt: '2026-10-06T10:00:00.000Z',
      latitude: 10.7,
      longitude: 106.7,
    });
    expect(d.enqueue).not.toHaveBeenCalled();
    expect(d.announce).toHaveBeenCalledWith(
      `${Strings.emergency.sending}. ${Strings.emergency.calling('Mẹ')}`,
    );
    expect(d.call).toHaveBeenCalledWith(expect.objectContaining({ kind: 'call' }));
  });

  it('gửi lỗi hoặc offline → vào hàng đợi, VẪN gọi người thân', async () => {
    for (const d of [
      deps({
        createEvent: jest.fn(async () => {
          throw new Error('500');
        }),
      }),
      deps({ isOnline: () => false }),
    ]) {
      await expect(sendSos('VoiceCommand', d)).resolves.toMatchObject({ sent: false });
      expect(d.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ detectionMethod: 'VoiceCommand' }),
      );
      expect(d.call).toHaveBeenCalled();
    }
  });

  it('mạng treo → cuộc gọi KHÔNG chờ gửi event xong', async () => {
    const d = deps({ createEvent: jest.fn(() => new Promise<never>(() => undefined)) });
    void sendSos('Manual', d);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(d.call).toHaveBeenCalled();
  });

  it('không có vị trí / không có contact → vẫn gửi, báo chưa có số, không gọi', async () => {
    const d = deps({ position: jest.fn(async () => null), contacts: jest.fn(async () => []) });
    await sendSos('Manual', d);
    expect(d.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: null, longitude: null }),
    );
    expect(d.announce).toHaveBeenCalledWith(expect.stringContaining(Strings.emergency.noContact));
    expect(d.call).not.toHaveBeenCalled();
  });
});
