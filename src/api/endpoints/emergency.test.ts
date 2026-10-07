import { apiClient } from '../client';

import { fetchEmergencyContacts } from './emergency';

jest.mock('../client', () => ({ apiClient: { get: jest.fn() } }));

const contact = (zaloDeepLink: string | null, isActive = true) => ({
  id: 'c1',
  contactName: 'Mẹ',
  contactType: 'Zalo',
  phoneNumber: null,
  zaloDeepLink,
  priorityOrder: 1,
  isActive,
  notes: null,
});

const respond = (data: unknown[]) =>
  (apiClient.get as jest.Mock).mockResolvedValueOnce({
    data: { success: true, message: '', data, errors: [] },
  });

describe('fetchEmergencyContacts', () => {
  it('giữ link Zalo thật, bỏ URL lạ (không mở trang lạ giữa lúc khẩn cấp)', async () => {
    respond([
      contact('https://zalo.me/0901234567'),
      contact('zalo://conversation?phone=0901'),
      contact('https://evil.example/zalo.me'),
      contact('intent://x#Intent;end'),
      contact('market://details?id=x'),
    ]);
    const links = (await fetchEmergencyContacts()).map((c) => c.zaloDeepLink);
    expect(links).toEqual([
      'https://zalo.me/0901234567',
      'zalo://conversation?phone=0901',
      null,
      null,
      null,
    ]);
  });

  it('bỏ contact đã tắt', async () => {
    respond([contact(null, false), contact(null)]);
    expect(await fetchEmergencyContacts()).toHaveLength(1);
  });
});
