import { ApiError, setLicenseHandler, setSessionExpiredHandler } from '@/api/client';
import {
  acceptPrivacyPolicy,
  fetchMe,
  login,
  logout,
  userSchema,
  type User,
} from '@/api/endpoints/auth';
import type { AuthToken } from '@/api/types';
import { Env } from '@/config/env';
import { Strings } from '@/constants/strings.vi';
import { stopGpsTracking } from '@/services/location/gpsTracking';
import { clearUserData } from '@/services/storage/db';
import {
  clearTokens,
  getCachedUser,
  getOrCreateClientDeviceId,
  getTokens,
  saveCachedUser,
  saveTokens,
} from '@/services/storage/secureStorage';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import { isVisuallyImpaired } from '@/utils/role';

import { announceLicense, licenseEventFor } from './licenseNotice';

export class WrongRoleError extends Error {
  constructor() {
    super('Account role is not VisuallyImpaired');
    this.name = 'WrongRoleError';
  }
}

async function applyUser(user: User): Promise<void> {
  await saveCachedUser(JSON.stringify(user));
  useAuthStore.getState().setUser(user);
  const event = licenseEventFor(user.licenseStatus, user.licenseExpiresAt);
  if (event) announceLicense(event);
}

/** Đăng nhập. Role khác VIU → revoke token vừa cấp rồi ném WrongRoleError (backend không chặn role). */
export async function signIn(email: string, password: string): Promise<void> {
  const clientDeviceId = await getOrCreateClientDeviceId();
  const token = await login(email.trim(), password, clientDeviceId);
  await saveTokens({ accessToken: token.accessToken, refreshToken: token.refreshToken });

  if (!isVisuallyImpaired(token.role)) {
    await logout(clientDeviceId).catch((e: unknown) => logger.warn('Logout wrong-role failed', e));
    await clearTokens();
    throw new WrongRoleError();
  }
  try {
    await applyUser(await fetchMe());
  } catch (error) {
    // Chưa có / hết license (402): vẫn vào app để còn gọi khẩn cấp — backend không chặn SOS
    if (error instanceof ApiError && error.status === 402)
      return await applyUser(userFromToken(token));
    // Không để token "mồ côi": UI báo lỗi nhưng lần mở app sau lại tự đăng nhập.
    await clearTokens();
    throw error;
  }
}

/** Thông tin tối thiểu có sẵn trong response login khi /users/me bị chặn. */
function userFromToken(token: AuthToken): User {
  return {
    id: token.userId,
    email: token.email,
    fullName: '',
    role: token.role,
    privacyConsentAcceptedAt: token.privacyConsentAcceptedAt ?? null,
    privacyPolicyVersion: token.privacyPolicyVersion ?? null,
    licenseStatus: token.licenseStatus ?? null,
    licenseExpiresAt: token.licenseExpiresAt ?? null,
  };
}

/**
 * Lúc mở app (offline-first): có profile cache → vào app NGAY, xác thực lại với server ở nền.
 * Chỉ đăng xuất khi server nói phiên không hợp lệ (401/403) hoặc role sai; mất mạng / 5xx thì giữ phiên.
 */
export async function bootstrapAuth(): Promise<void> {
  const store = useAuthStore.getState();
  if (!(await getTokens())) return store.signOut();

  const cached = parseCachedUser(await getCachedUser());
  if (cached) store.setUser(cached);

  try {
    const user = await fetchMe();
    if (!isVisuallyImpaired(user.role)) return await endSession();
    await applyUser(user);
  } catch (error) {
    const authFailure = error instanceof ApiError && (error.status === 401 || error.status === 403);
    if (cached && !authFailure) return;
    logger.warn('Auth bootstrap failed', error instanceof ApiError ? error.status : error);
    if (authFailure) return await endSession();
    store.signOut();
  }
}

async function endSession(): Promise<void> {
  await clearTokens();
  useAuthStore.getState().signOut();
}

function parseCachedUser(json: string | null): User | null {
  if (!json) return null;
  try {
    return userSchema.parse(JSON.parse(json));
  } catch {
    return null;
  }
}

export async function acceptPrivacy(): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('Not signed in');
  await acceptPrivacyPolicy(Env.privacyPolicyVersion);
  await applyUser({
    ...user,
    privacyConsentAcceptedAt: new Date().toISOString(),
    privacyPolicyVersion: Env.privacyPolicyVersion,
  });
}

/** Logout: lỗi mạng khi gọi API không chặn việc đăng xuất local (CLAUDE.md §8). */
export async function signOut(): Promise<void> {
  const clientDeviceId = await getOrCreateClientDeviceId();
  await logout(clientDeviceId).catch((e: unknown) => logger.warn('Logout API failed', e));
  await clearTokens();
  await clearUserData().catch((e: unknown) => logger.warn('Clear SQLite failed', e));
  await stopGpsTracking();
  // SignalR tự ngắt khi rời layout chính (useArrivalNotifications)
  useAuthStore.getState().signOut();
}

/** Gọi 1 lần khi khởi động: refresh thất bại → về Login + TTS; 402 / header cảnh báo license → TTS. */
export function registerSessionExpiredHandler(): void {
  setSessionExpiredHandler(() => {
    void stopGpsTracking();
    useAuthStore.getState().signOut();
    ttsService.enqueue({ text: Strings.auth.sessionExpired, priority: TtsPriority.SYSTEM });
  });
  setLicenseHandler(announceLicense);
}

/** Map lỗi đăng nhập → câu tiếng Việt cho TTS/UI (không đọc `detail` tiếng Anh). */
export function signInErrorMessage(error: unknown): string {
  if (error instanceof WrongRoleError) return Strings.auth.wrongRole;
  if (!(error instanceof ApiError)) return Strings.errors.unavailable;
  switch (error.status) {
    case 0:
      return Strings.errors.offline;
    case 400:
    case 401:
      return Strings.auth.wrongCredentials;
    case 403:
      return Strings.auth.accountLocked;
    case 429:
      return Strings.auth.tooManyAttempts;
    default:
      return Strings.errors.unavailable;
  }
}
