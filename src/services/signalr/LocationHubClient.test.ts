import { refreshSingleFlight } from '@/api/client';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import { getTokens } from '@/services/storage/secureStorage';

import { freshAccessToken, isTokenExpiring } from './LocationHubClient';

jest.mock('@/api/client', () => ({ refreshSingleFlight: jest.fn() }));
jest.mock('@/services/storage/secureStorage', () => ({ getTokens: jest.fn() }));
jest.mock('@/services/network/NetworkMonitor', () => ({
  NetworkMonitor: { isOnline: jest.fn() },
}));

const jwt = (exp: number) =>
  `h.${btoa(JSON.stringify({ exp })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.s`;

describe('isTokenExpiring', () => {
  const now = 1_000_000_000_000;
  it('còn lâu mới hết hạn → dùng tiếp', () => {
    expect(isTokenExpiring(jwt(now / 1000 + 600), now)).toBe(false);
  });
  it('hết hạn / sắp hết hạn / không đọc được → refresh', () => {
    expect(isTokenExpiring(jwt(now / 1000 - 1), now)).toBe(true);
    expect(isTokenExpiring(jwt(now / 1000 + 10), now)).toBe(true);
    expect(isTokenExpiring('rác', now)).toBe(true);
  });
});

describe('freshAccessToken', () => {
  const expired = jwt(1);
  beforeEach(() => {
    jest.mocked(getTokens).mockResolvedValue({ accessToken: expired, refreshToken: 'r' });
    jest.mocked(refreshSingleFlight).mockReset().mockResolvedValue('new');
  });
  it('offline → không refresh (refresh mất response = server coi là reuse, thu hồi mọi phiên)', async () => {
    jest.mocked(NetworkMonitor.isOnline).mockReturnValue(false);
    await expect(freshAccessToken()).resolves.toBe(expired);
    expect(refreshSingleFlight).not.toHaveBeenCalled();
  });
  it('online + sắp hết hạn → refresh', async () => {
    jest.mocked(NetworkMonitor.isOnline).mockReturnValue(true);
    await expect(freshAccessToken()).resolves.toBe('new');
  });
});
