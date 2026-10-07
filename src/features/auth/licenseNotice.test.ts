import { Strings } from '@/constants/strings.vi';
import { ttsService } from '@/services/tts/TtsService';

import {
  announceLicense,
  isNavigationAllowed,
  licenseEventFor,
  resetLicenseNotice,
} from './licenseNotice';

jest.mock('@/services/tts/TtsService', () => ({
  TtsPriority: { SYSTEM: 2 },
  ttsService: { enqueue: jest.fn() },
}));

const NOW = Date.parse('2026-10-02T10:00:00Z');
const inDays = (d: number) => new Date(NOW + d * 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
  resetLicenseNotice();
});

describe('licenseEventFor (khớp LicenseValidationMiddleware)', () => {
  it.each([
    ['None', null, { kind: 'blocked' }],
    ['Expired', inDays(-5), { kind: 'blocked' }], // quá 3 ngày ân hạn
    ['Expired', inDays(-1), { kind: 'expiring', daysLeft: 0 }], // còn trong ân hạn
    ['Active', inDays(2), { kind: 'expiring', daysLeft: 2 }],
    ['Trial', inDays(3), { kind: 'trial', daysLeft: 3 }],
    ['Trial', inDays(6), { kind: 'trial', daysLeft: 6 }], // dùng thử luôn báo số ngày
    ['Active', inDays(20), null],
    [null, null, null], // chưa đồng bộ → để middleware quyết định
  ])('%s, hết hạn %s → %o', (status, expiresAt, expected) => {
    expect(licenseEventFor(status, expiresAt, NOW)).toEqual(expected);
  });
});

describe('isNavigationAllowed (Update Report §3.4)', () => {
  it('chỉ chặn khi chưa từng có gói; hết hạn / chưa đồng bộ vẫn dẫn đường', () => {
    expect(isNavigationAllowed('None')).toBe(false);
    expect(isNavigationAllowed('Expired')).toBe(true);
    expect(isNavigationAllowed('Trial')).toBe(true);
    expect(isNavigationAllowed(null)).toBe(true);
  });
});

describe('announceLicense', () => {
  it('mỗi loại chỉ đọc MỘT lần mỗi lần mở app', () => {
    announceLicense({ kind: 'blocked' });
    announceLicense({ kind: 'blocked' });
    announceLicense({ kind: 'expiring', daysLeft: 2 });
    announceLicense({ kind: 'expiring', daysLeft: 1 });
    expect((ttsService.enqueue as jest.Mock).mock.calls.map((c) => c[0].text)).toEqual([
      Strings.license.blocked,
      Strings.license.expiring(2),
    ]);
  });
});
