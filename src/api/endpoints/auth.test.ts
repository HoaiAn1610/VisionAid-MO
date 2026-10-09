import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { apiClient } from '../client';
import { acceptPrivacyPolicy, fetchMe, login, logout } from './auth';

jest.mock('@/services/storage/secureStorage', () => ({
  getTokens: jest.fn(async () => null),
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
  getOrCreateClientDeviceId: jest.fn(async () => 'device-1'),
}));

let lastRequest: InternalAxiosRequestConfig | undefined;
function reply(data: unknown) {
  apiClient.defaults.adapter = async (config): Promise<AxiosResponse> => {
    lastRequest = config;
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
}
const body = () => JSON.parse(lastRequest?.data as string) as Record<string, unknown>;
const ok = (data: unknown) => ({ success: true, message: 'Success', data, errors: [] });

describe('auth endpoints — khớp contract backend (docs/specs/auth.md)', () => {
  it('login gửi device lồng trong body, deviceType "Android", parse AuthTokenResponse', async () => {
    reply(
      ok({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: '2026-10-27T10:00:00+07:00',
        userId: 'u1',
        email: 'viu@visionaid.vn',
        role: 'VisuallyImpaired',
        organizationId: null,
        privacyConsentAcceptedAt: null,
        privacyPolicyVersion: null,
      }),
    );

    const token = await login('viu@visionaid.vn', 'pw', 'device-1');

    expect(lastRequest?.url).toBe('/api/auth/login');
    expect(body()).toMatchObject({
      email: 'viu@visionaid.vn',
      password: 'pw',
      device: { clientDeviceId: 'device-1', deviceType: 'Android' },
    });
    expect(token.role).toBe('VisuallyImpaired');
  });

  it('login với response sai shape → ném lỗi (không nuốt dữ liệu hỏng)', async () => {
    reply(ok({ accessToken: 'at' }));
    await expect(login('a@b.vn', 'pw', 'd')).rejects.toThrow();
  });

  it('fetchMe parse UserResponse, bỏ qua field không dùng', async () => {
    reply(
      ok({
        id: 'u1',
        email: 'viu@visionaid.vn',
        fullName: 'Người dùng',
        phoneNumber: null,
        role: 'VisuallyImpaired',
        organizationId: null,
        isActive: true,
        avatarUrl: null,
        lastLoginAt: null,
        privacyConsentAcceptedAt: '2026-09-27T10:00:00+07:00',
        privacyPolicyVersion: '1.0',
        deletedAt: null,
        createdAt: '2026-09-01T10:00:00+07:00',
        updatedAt: '2026-09-27T10:00:00+07:00',
      }),
    );
    const me = await fetchMe();
    expect(me).toEqual({
      id: 'u1',
      email: 'viu@visionaid.vn',
      fullName: 'Người dùng',
      phoneNumber: null,
      role: 'VisuallyImpaired',
      privacyConsentAcceptedAt: '2026-09-27T10:00:00+07:00',
      privacyPolicyVersion: '1.0',
    });
  });

  it('logout và accept-privacy gửi đúng body', async () => {
    reply(ok(null));
    await logout('device-1');
    expect([lastRequest?.url, body()]).toEqual([
      '/api/auth/logout',
      { clientDeviceId: 'device-1' },
    ]);
    await acceptPrivacyPolicy('1.0');
    expect([lastRequest?.url, body()]).toEqual([
      '/api/auth/accept-privacy-policy',
      { policyVersion: '1.0' },
    ]);
  });
});
