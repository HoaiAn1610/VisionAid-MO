import { ApiError } from '@/api/client';
import * as authApi from '@/api/endpoints/auth';
import { Strings } from '@/constants/strings.vi';
import { useAuthStore } from '@/stores/authStore';

import {
  acceptPrivacy,
  bootstrapAuth,
  signIn,
  signInErrorMessage,
  signOut,
  WrongRoleError,
} from './authService';

jest.mock('@/api/endpoints/auth', () => ({
  ...jest.requireActual('@/api/endpoints/auth'),
  login: jest.fn(),
  logout: jest.fn(),
  fetchMe: jest.fn(),
  acceptPrivacyPolicy: jest.fn(),
}));

const secure: Record<string, string | null> = {};
jest.mock('@/services/storage/secureStorage', () => ({
  getOrCreateClientDeviceId: jest.fn(async () => 'device-1'),
  getTokens: jest.fn(async () =>
    secure.access ? { accessToken: secure.access, refreshToken: secure.refresh } : null,
  ),
  saveTokens: jest.fn(async (t: { accessToken: string; refreshToken: string }) => {
    secure.access = t.accessToken;
    secure.refresh = t.refreshToken;
  }),
  clearTokens: jest.fn(async () => {
    secure.access = null;
    secure.refresh = null;
    secure.user = null;
  }),
  getCachedUser: jest.fn(async () => secure.user ?? null),
  saveCachedUser: jest.fn(async (json: string) => {
    secure.user = json;
  }),
}));
jest.mock('@/services/storage/db', () => ({ clearUserData: jest.fn(async () => {}) }));
jest.mock('@/services/tts/TtsService', () => ({
  TtsPriority: { SYSTEM: 2 },
  ttsService: { enqueue: jest.fn() },
}));

const api = authApi as jest.Mocked<typeof authApi>;

const token = (role: string) => ({
  accessToken: 'at',
  refreshToken: 'rt',
  expiresAt: '2026-10-27T10:00:00+07:00',
  userId: 'u1',
  email: 'viu@visionaid.vn',
  role,
  organizationId: null,
  privacyConsentAcceptedAt: null,
  privacyPolicyVersion: null,
});

const user = (over: Partial<authApi.User> = {}): authApi.User => ({
  id: 'u1',
  email: 'viu@visionaid.vn',
  fullName: 'Người dùng',
  role: 'VisuallyImpaired',
  privacyConsentAcceptedAt: null,
  privacyPolicyVersion: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(secure)) delete secure[k];
  useAuthStore.setState({ status: 'loading', user: null });
});

describe('signIn', () => {
  it('VIU chưa đồng ý chính sách → lưu token, vào needsConsent', async () => {
    api.login.mockResolvedValue(token('VisuallyImpaired'));
    api.fetchMe.mockResolvedValue(user());

    await signIn(' viu@visionaid.vn ', 'pw');

    expect(api.login).toHaveBeenCalledWith('viu@visionaid.vn', 'pw', 'device-1');
    expect(secure.access).toBe('at');
    expect(useAuthStore.getState().status).toBe('needsConsent');
  });

  it('VIU đã đồng ý đúng phiên bản hiện tại → signedIn', async () => {
    api.login.mockResolvedValue(token('VisuallyImpaired'));
    api.fetchMe.mockResolvedValue(
      user({ privacyConsentAcceptedAt: '2026-09-27T10:00:00+07:00', privacyPolicyVersion: '1.0' }),
    );
    await signIn('viu@visionaid.vn', 'pw');
    expect(useAuthStore.getState().status).toBe('signedIn');
  });

  it('đồng ý phiên bản chính sách cũ → phải đồng ý lại', async () => {
    api.login.mockResolvedValue(token('VisuallyImpaired'));
    api.fetchMe.mockResolvedValue(
      user({ privacyConsentAcceptedAt: '2026-01-01T10:00:00+07:00', privacyPolicyVersion: '0.9' }),
    );
    await signIn('viu@visionaid.vn', 'pw');
    expect(useAuthStore.getState().status).toBe('needsConsent');
  });

  it('role khác VIU → revoke token (logout), xóa token, ném WrongRoleError', async () => {
    api.login.mockResolvedValue(token('Caregiver'));
    api.logout.mockResolvedValue();

    await expect(signIn('caregiver@gmail.com', 'pw')).rejects.toBeInstanceOf(WrongRoleError);

    expect(api.logout).toHaveBeenCalledWith('device-1');
    expect(secure.access).toBeNull();
    expect(api.fetchMe).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('loading');
  });
});

describe('bootstrapAuth', () => {
  it('không có token → signedOut', async () => {
    await bootstrapAuth();
    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('offline + có profile cache → vào app bằng cache', async () => {
    secure.access = 'at';
    secure.refresh = 'rt';
    secure.user = JSON.stringify(
      user({ privacyConsentAcceptedAt: '2026-09-27T10:00:00+07:00', privacyPolicyVersion: '1.0' }),
    );
    api.fetchMe.mockRejectedValue(new ApiError(0, 'Network Error', 'offline'));

    await bootstrapAuth();
    expect(useAuthStore.getState().status).toBe('signedIn');
  });

  it('offline + không có cache → signedOut', async () => {
    secure.access = 'at';
    secure.refresh = 'rt';
    api.fetchMe.mockRejectedValue(new ApiError(0, 'Network Error', 'offline'));
    await bootstrapAuth();
    expect(useAuthStore.getState().status).toBe('signedOut');
  });
});

describe('acceptPrivacy / signOut', () => {
  it('đồng ý chính sách → gọi API với version hiện tại, chuyển signedIn', async () => {
    useAuthStore.getState().setUser(user());
    api.acceptPrivacyPolicy.mockResolvedValue();

    await acceptPrivacy();

    expect(api.acceptPrivacyPolicy).toHaveBeenCalledWith('1.0');
    expect(useAuthStore.getState().status).toBe('signedIn');
  });

  it('logout lỗi mạng vẫn đăng xuất local', async () => {
    secure.access = 'at';
    useAuthStore.getState().setUser(user());
    api.logout.mockRejectedValue(new ApiError(0, 'Network Error', 'offline'));

    await signOut();

    expect(secure.access).toBeNull();
    expect(useAuthStore.getState().status).toBe('signedOut');
  });
});

describe('signInErrorMessage', () => {
  it.each([
    [new ApiError(401, 'Unauthorized', 'x'), Strings.auth.wrongCredentials],
    [new ApiError(403, 'Forbidden', 'x'), Strings.auth.accountLocked],
    [new ApiError(429, 'Too Many Requests', ''), Strings.auth.tooManyAttempts],
    [new ApiError(0, 'Network Error', ''), Strings.errors.offline],
    [new WrongRoleError(), Strings.auth.wrongRole],
  ])('%s → câu tiếng Việt', (error, message) => {
    expect(signInErrorMessage(error)).toBe(message);
  });
});
