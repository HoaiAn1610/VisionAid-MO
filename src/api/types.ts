import { z } from 'zod';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: string[];
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** RFC 7807 Problem Details */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: Record<string, string[]>;
}

/** Lỗi đã chuẩn hóa bởi Axios interceptor. status = 0 → lỗi mạng / timeout. */
export interface AppError {
  status: number;
  title: string;
  detail: string;
  fieldErrors?: Record<string, string[]>;
}

/** WGS84 — Backend tự convert sang geography(Point,4326). */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** `AuthTokenResponse` của backend (login + refresh). `expiresAt` là hạn của REFRESH token. */
export const authTokenSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.string(),
  userId: z.string(),
  email: z.string(),
  role: z.string(),
  organizationId: z.string().nullable(),
  // Có trong AuthTokenResponse từ backend 41bed01 — dùng khi /users/me bị chặn vì license (402)
  privacyConsentAcceptedAt: z.string().nullable().optional(),
  privacyPolicyVersion: z.string().nullable().optional(),
});
export type AuthToken = z.infer<typeof authTokenSchema>;

export const apiResponseSchema = <T extends z.ZodType>(data: T) =>
  z.object({ success: z.boolean(), message: z.string(), data, errors: z.array(z.string()) });
