import { AxiosError, create, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { Env } from '@/config/env';
import {
  clearTokens,
  getOrCreateClientDeviceId,
  getTokens,
  saveTokens,
} from '@/services/storage/secureStorage';
import { logger } from '@/utils/logger';

import { apiResponseSchema, authTokenSchema, type AppError } from './types';

const TIMEOUT_MS = 15_000;

/** Lỗi đã chuẩn hóa từ cả 2 dạng lỗi của backend (ProblemDetails / ApiResponse success:false). */
export class ApiError extends Error implements AppError {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail: string,
    readonly fieldErrors?: Record<string, string[]>,
    /** Mã lỗi máy đọc được (ProblemDetails `errorCode`, ví dụ `FACE_SERVICE_UNAVAILABLE`). */
    readonly errorCode?: string,
    /** `traceId` của server — có trong log để BE tra đúng request (GAP-37). */
    readonly traceId?: string,
  ) {
    super(`${status} ${title}: ${detail}${traceId ? ` [traceId ${traceId}]` : ''}`);
    this.name = 'ApiError';
  }
}

export const apiClient = create({ baseURL: Env.apiBaseUrl, timeout: TIMEOUT_MS });
// Instance riêng cho /auth/refresh: không đi qua interceptor → không thể lặp refresh.
export const refreshClient = create({ baseURL: Env.apiBaseUrl, timeout: TIMEOUT_MS });

let onSessionExpired: () => void = () => {};
/** App đăng ký: signOut store + TTS "Phiên đăng nhập đã hết hạn" + dừng GPS/SignalR. */
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

export type LicenseEvent =
  | { kind: 'blocked' }
  | { kind: 'expiring'; daysLeft: number }
  | { kind: 'trial'; daysLeft: number };
let onLicenseEvent: (event: LicenseEvent) => void = () => {};
/**
 * App đăng ký: TTS báo license. Backend (LicenseValidationMiddleware) trả 402 khi chưa có / hết
 * license quá 3 ngày; còn trong 3 ngày ân hạn thì gửi header `X-License-Warning: expiring-in-Nd`.
 */
export function setLicenseHandler(handler: (event: LicenseEvent) => void): void {
  onLicenseEvent = handler;
}

function readLicenseWarning(headers: unknown): void {
  const value = (headers as Record<string, unknown> | undefined)?.['x-license-warning'];
  const match = typeof value === 'string' ? /^expiring-in-(\d+)d$/.exec(value) : null;
  if (match) onLicenseEvent({ kind: 'expiring', daysLeft: Number(match[1]) });
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

apiClient.interceptors.request.use(async (config) => {
  const tokens = await getTokens();
  if (tokens) config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    readLicenseWarning(response.headers);
    return response;
  },
  async (error: unknown) => {
    if (!(error instanceof AxiosError) || !error.config) throw toApiError(error);
    const config = error.config as RetriableConfig;
    readLicenseWarning(error.response?.headers);
    if (error.response?.status === 402) onLicenseEvent({ kind: 'blocked' });

    if (error.response?.status !== 401 || config._retried) throw toApiError(error);

    // Chưa có phiên (ví dụ login sai mật khẩu) → trả lỗi nguyên bản, không phải "hết phiên".
    const tokens = await getTokens();
    if (!tokens) throw toApiError(error);

    config._retried = true;
    // Request này gửi đi bằng token cũ, token đã được làm mới trong lúc chờ → chỉ cần retry.
    const current = `Bearer ${tokens.accessToken}`;
    if (config.headers.get('Authorization') !== current) {
      config.headers.set('Authorization', current);
      return apiClient.request(config);
    }

    const refreshed = await refreshSingleFlight();
    if (!refreshed) throw toApiError(error);

    config.headers.set('Authorization', `Bearer ${refreshed}`);
    return apiClient.request(config);
  },
);

let refreshPromise: Promise<string | null> | null = null;

/**
 * Single-flight (CLAUDE.md §8): mọi request 401 đồng thời chờ CHUNG một lần refresh.
 * Gửi lại refresh token cũ sau khi đã rotate = reuse → server revoke mọi phiên (BR-34).
 * @returns access token mới, hoặc null nếu phiên đã hết (đã xóa token + báo app).
 * @throws ApiError status 0 khi không tới được server (phiên được giữ nguyên).
 */
export function refreshSingleFlight(): Promise<string | null> {
  refreshPromise ??= refreshTokens().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function refreshTokens(): Promise<string | null> {
  try {
    const tokens = await getTokens();
    if (!tokens) return null; // đã logout trong lúc chờ
    const clientDeviceId = await getOrCreateClientDeviceId();
    const res = await refreshClient.post('/api/auth/refresh', {
      refreshToken: tokens.refreshToken,
      clientDeviceId,
    });
    const { data } = apiResponseSchema(authTokenSchema).parse(res.data);
    await saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken;
  } catch (error) {
    // Backend trả 403 cho MỌI lỗi refresh thật sự (token sai / reuse / hết hạn / bị khóa).
    const status = error instanceof AxiosError ? error.response?.status : undefined;
    if (status === 401 || status === 403) {
      logger.warn('Refresh rejected, session expired', status);
      await clearTokens();
      onSessionExpired();
      return null;
    }
    // Mất mạng / 5xx (đã gặp 504 từ gateway) / 429: lỗi tạm thời → GIỮ phiên, báo lỗi cho caller.
    // Đăng xuất người khiếm thị chỉ vì server chập chờn là không chấp nhận được.
    logger.warn('Refresh failed, session kept', status ?? 'network');
    throw toApiError(error);
  }
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!(error instanceof AxiosError)) {
    return new ApiError(0, 'Unknown Error', error instanceof Error ? error.message : String(error));
  }
  const response: AxiosResponse | undefined = error.response;
  if (!response) return new ApiError(0, 'Network Error', error.message);

  const body: unknown = response.data;
  if (isRecord(body)) {
    // 1) ProblemDetails
    if (typeof body.title === 'string') {
      return new ApiError(
        response.status,
        body.title,
        typeof body.detail === 'string' ? body.detail : '',
        isFieldErrors(body.errors) ? body.errors : undefined,
        typeof body.errorCode === 'string' ? body.errorCode : undefined,
        typeof body.traceId === 'string' ? body.traceId : undefined,
      );
    }
    // 2) ApiResponse { success: false, errors: [] }
    if (Array.isArray(body.errors)) {
      const errors = body.errors.filter((e): e is string => typeof e === 'string');
      return new ApiError(response.status, httpTitle(response.status), errors.join('; '));
    }
  }
  return new ApiError(response.status, httpTitle(response.status), error.message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFieldErrors(value: unknown): value is Record<string, string[]> {
  return isRecord(value) && Object.values(value).every(Array.isArray);
}

function httpTitle(status: number): string {
  if (status === 401) return 'Unauthorized';
  if (status === 402) return 'Payment Required';
  if (status === 403) return 'Forbidden';
  if (status === 429) return 'Too Many Requests';
  if (status >= 500) return 'Internal Server Error';
  return 'Request Failed';
}
