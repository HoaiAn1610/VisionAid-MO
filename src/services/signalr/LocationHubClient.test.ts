import { isTokenExpiring } from './LocationHubClient';

jest.mock('@/api/client', () => ({ refreshSingleFlight: jest.fn() }));
jest.mock('@/services/storage/secureStorage', () => ({ getTokens: jest.fn() }));

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
