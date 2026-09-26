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
