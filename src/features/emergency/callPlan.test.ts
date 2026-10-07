import type { EmergencyContact } from '@/api/endpoints/emergency';

import { isEmergencyNumber, planEmergencyCall } from './callPlan';

const contact = (over: Partial<EmergencyContact>): EmergencyContact => ({
  id: over.contactName ?? 'c',
  contactName: 'Mẹ',
  contactType: 'Phone',
  phoneNumber: '0901 234 567',
  zaloDeepLink: null,
  priorityOrder: 1,
  ...over,
});

describe('planEmergencyCall', () => {
  it('tự quay người có ưu tiên cao nhất, bỏ ký tự thừa trong số', () => {
    const plan = planEmergencyCall([
      contact({ contactName: 'Bố', priorityOrder: 2, phoneNumber: '0911111111' }),
      contact({ contactName: 'Mẹ', priorityOrder: 1 }),
    ]);
    expect(plan).toMatchObject({ kind: 'call', number: '0901234567' });
    expect(plan.kind === 'call' && plan.contact.contactName).toBe('Mẹ');
  });

  it('115 xếp trước nhưng không tự quay được → gọi người thân tiếp theo', () => {
    const plan = planEmergencyCall([
      contact({ contactName: 'Cấp cứu', priorityOrder: 1, phoneNumber: '115' }),
      contact({ contactName: 'Hotline trung tâm', priorityOrder: 2, phoneNumber: '1900 1234' }),
    ]);
    expect(plan).toMatchObject({ kind: 'call', number: '19001234' });
  });

  it('chỉ có số khẩn cấp → mở trình quay số', () => {
    expect(planEmergencyCall([contact({ phoneNumber: '112' })])).toMatchObject({
      kind: 'dial',
      number: '112',
    });
  });

  it('không có số điện thoại → Zalo; không có gì → none', () => {
    expect(
      planEmergencyCall([
        contact({ contactType: 'Zalo', phoneNumber: null, zaloDeepLink: 'https://zalo.me/0901' }),
      ]),
    ).toMatchObject({ kind: 'zalo', url: 'https://zalo.me/0901' });
    expect(planEmergencyCall([])).toEqual({ kind: 'none' });
  });

  it('contact loại Zalo không dùng số điện thoại để gọi', () => {
    const plan = planEmergencyCall([
      contact({ contactType: 'Zalo', zaloDeepLink: 'https://zalo.me/x' }),
    ]);
    expect(plan.kind).toBe('zalo');
  });

  it('isEmergencyNumber bỏ khoảng trắng', () => {
    expect(isEmergencyNumber(' 1 1 5 ')).toBe(true);
    expect(isEmergencyNumber('0901115115')).toBe(false);
  });
});
