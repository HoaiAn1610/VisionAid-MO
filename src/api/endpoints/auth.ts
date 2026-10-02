import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { z } from 'zod';

import { apiClient } from '../client';
import { apiResponseSchema, authTokenSchema, type AuthToken } from '../types';

// Chỉ các field mobile dùng từ `UserResponse` (GET /api/users/me)
export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
  role: z.string(),
  privacyConsentAcceptedAt: z.string().nullable(),
  privacyPolicyVersion: z.string().nullable(),
  // Backend 8f2641a: 'Trial' | 'Active' | 'Expired' | 'None' (null = chưa đồng bộ)
  licenseStatus: z.string().nullable().optional(),
  licenseExpiresAt: z.string().nullable().optional(),
});
export type User = z.infer<typeof userSchema>;

export async function login(
  email: string,
  password: string,
  clientDeviceId: string,
  fcmToken?: string,
): Promise<AuthToken> {
  const res = await apiClient.post('/api/auth/login', {
    email,
    password,
    device: {
      clientDeviceId,
      fcmToken,
      deviceType: 'Android',
      deviceModel: (Platform.constants as { Model?: string }).Model,
      appVersion: Constants.expoConfig?.version,
    },
  });
  return apiResponseSchema(authTokenSchema).parse(res.data).data;
}

export async function logout(clientDeviceId: string): Promise<void> {
  await apiClient.post('/api/auth/logout', { clientDeviceId });
}

export async function acceptPrivacyPolicy(policyVersion: string): Promise<void> {
  await apiClient.post('/api/auth/accept-privacy-policy', { policyVersion });
}

export async function fetchMe(): Promise<User> {
  const res = await apiClient.get('/api/users/me');
  return apiResponseSchema(userSchema).parse(res.data).data;
}
