import * as authApi from '@/api/endpoints/auth';
import { Strings } from '@/constants/strings.vi';
import { useAuthStore } from '@/stores/authStore';

import { ApiError, setLicenseHandler, type LicenseEvent } from '@/api/client';
import { ttsService } from '@/services/tts/TtsService';

import { resetLicenseNotice } from './licenseNotice';

import {
  acceptPrivacy,
  bootstrapAuth,
  registerSessionExpiredHandler,
  signIn,
  signInErrorMessage,
  signOut,
  WrongRoleError,
} from './authService';

jest.mock('@/api/client', () => ({
  ...jest.requireActual('@/api/client'),
  setSessionExpiredHandler: jest.fn(),
  setLicenseHandler: jest.fn(),
}));
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
jest.mock('@/services/storage/db', () => ({
  clearUserData: jest.fn(async () => {}),
  clearPersonalCache: jest.fn(async () => {}),
}));
jest.mock('@/services/fcm/FcmService', () => ({ getFcmToken: jest.fn(async () => 'fcm-1') }));
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
  resetLicenseNotice();
  for (const k of Object.keys(secure)) delete secure[k];
  useAuthStore.setState({ status: 'loading', user: null });
});

describe('signIn', () => {
  it('VIU chưa đồng ý chính sách → lưu token, vào needsConsent', async () => {
    api.login.mockResolvedValue(token('VisuallyImpaired'));
    api.fetchMe.mockResolvedValue(user());

    await signIn(' viu@visionaid.vn ', 'pw');

    expect(api.login).toHaveBeenCalledWith('viu@visionaid.vn', 'pw', 'device-1', 'fcm-1');
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

describe('license (402 từ LicenseValidationMiddleware)', () => {
  it('/users/me bị 402 → vẫn đăng nhập bằng thông tin trong response login (còn dùng được SOS)', async () => {
    api.login.mockResolvedValue({
      ...token('VisuallyImpaired'),
      privacyConsentAcceptedAt: '2026-09-27T10:00:00+07:00',
      privacyPolicyVersion: '1.0',
    });
    api.fetchMe.mockRejectedValue(new ApiError(402, 'Payment Required', 'Chưa có license'));

    await signIn('viu@visionaid.vn', 'pw');

    expect(secure.access).toBe('at');
    expect(useAuthStore.getState()).toMatchObject({
      status: 'signedIn',
      user: { id: 'u1', email: 'viu@visionaid.vn', role: 'VisuallyImpaired' },
    });
  });

  it('/users/me báo licenseStatus None → TTS báo trước ngay khi đăng nhập (không đợi gặp 402)', async () => {
    api.login.mockResolvedValue(token('VisuallyImpaired'));
    api.fetchMe.mockResolvedValue(user({ licenseStatus: 'None', licenseExpiresAt: null }));
    await signIn('viu@visionaid.vn', 'pw');
    expect((ttsService.enqueue as jest.Mock).mock.calls.map((c) => c[0].text)).toContain(
      Strings.license.blocked,
    );
  });

  it('TTS báo bị chặn / sắp hết hạn — mỗi loại chỉ MỘT lần mỗi lần mở app', () => {
    registerSessionExpiredHandler();
    const handler = (setLicenseHandler as jest.Mock).mock.calls[0][0] as (e: LicenseEvent) => void;
    handler({ kind: 'blocked' });
    handler({ kind: 'blocked' });
    handler({ kind: 'expiring', daysLeft: 2 });
    handler({ kind: 'expiring', daysLeft: 2 });
    expect((ttsService.enqueue as jest.Mock).mock.calls.map((c) => c[0].text)).toEqual([
      Strings.license.blocked,
      Strings.license.expiring(2),
    ]);
  });
});

describe('signIn — lỗi sau khi đã lưu token', () => {
  it('fetchMe lỗi → xóa token vừa lưu (không tự đăng nhập lần mở app sau)', async () => {
    api.login.mockResolvedValue(token('VisuallyImpaired'));
    api.fetchMe.mockRejectedValue(new ApiError(0, 'Network Error', 'offline'));

    await expect(signIn('viu@visionaid.vn', 'pw')).rejects.toMatchObject({ status: 0 });
    expect(secure.access).toBeNull();
  });
});

describe('bootstrapAuth — offline-first, không chờ mạng', () => {
  const accepted = user({
    privacyConsentAcceptedAt: '2026-09-27T10:00:00+07:00',
    privacyPolicyVersion: '1.0',
  });

  it('có profile cache → vào app NGAY trước khi server trả lời', async () => {
    secure.access = 'at';
    secure.refresh = 'rt';
    secure.user = JSON.stringify(accepted);
    let statusWhileFetching: string | undefined;
    api.fetchMe.mockImplementation(async () => {
      statusWhileFetching = useAuthStore.getState().status;
      return accepted;
    });

    await bootstrapAuth();
    expect(statusWhileFetching).toBe('signedIn');
  });

  it('server lỗi 5xx + có cache → giữ phiên', async () => {
    secure.access = 'at';
    secure.refresh = 'rt';
    secure.user = JSON.stringify(accepted);
    api.fetchMe.mockRejectedValue(new ApiError(500, 'Internal Server Error', ''));
    await bootstrapAuth();
    expect(useAuthStore.getState().status).toBe('signedIn');
  });

  it('401/403 (phiên không còn hợp lệ) + có cache → đăng xuất và xóa token', async () => {
    secure.access = 'at';
    secure.refresh = 'rt';
    secure.user = JSON.stringify(accepted);
    api.fetchMe.mockRejectedValue(new ApiError(403, 'Forbidden', 'deactivated'));
    await bootstrapAuth();
    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(secure.access).toBeNull();
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
