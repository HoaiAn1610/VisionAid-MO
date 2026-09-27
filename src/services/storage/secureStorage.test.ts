import {
  clearTokens,
  getCachedUser,
  getOrCreateClientDeviceId,
  getTokens,
  saveCachedUser,
  saveTokens,
} from './secureStorage';

const mockMem = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockMem.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockMem.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockMem.delete(k)),
}));
let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `mockUuid-${++mockUuid}` }));

beforeEach(() => mockMem.clear());

describe('secureStorage', () => {
  it('clientDeviceId sinh MỘT lần và giữ nguyên', async () => {
    const first = await getOrCreateClientDeviceId();
    expect(await getOrCreateClientDeviceId()).toBe(first);
  });

  it('token: thiếu một trong hai → coi như chưa đăng nhập', async () => {
    await saveTokens({ accessToken: 'a', refreshToken: 'r' });
    expect(await getTokens()).toEqual({ accessToken: 'a', refreshToken: 'r' });
    mockMem.delete('va_refresh_token');
    expect(await getTokens()).toBeNull();
  });

  it('clearTokens xóa token + profile cache nhưng GIỮ clientDeviceId', async () => {
    const deviceId = await getOrCreateClientDeviceId();
    await saveTokens({ accessToken: 'a', refreshToken: 'r' });
    await saveCachedUser('{"id":"u1"}');

    await clearTokens();

    expect(await getTokens()).toBeNull();
    expect(await getCachedUser()).toBeNull();
    expect(await getOrCreateClientDeviceId()).toBe(deviceId);
  });
});
