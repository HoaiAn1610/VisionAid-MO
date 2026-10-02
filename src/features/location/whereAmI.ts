import { ApiError } from '@/api/client';
import type { GpsPoint, ServerLocation } from '@/api/endpoints/locations';
import { Strings } from '@/constants/strings.vi';
import type { CachedLocation } from '@/services/storage/locationCache';
import { logger } from '@/utils/logger';

export interface WhereAmIDeps {
  isOnline(): boolean;
  /** Điểm GPS hiện tại; `null` khi không có quyền / không bắt được tín hiệu. */
  currentPoint(): Promise<GpsPoint | null>;
  recordGps(point: GpsPoint): Promise<string | null>;
  fetchMyLocation(): Promise<ServerLocation>;
  readCache(): Promise<CachedLocation | null>;
  saveCache(location: CachedLocation): Promise<void>;
  now(): number;
}

export type WhereAmIResult =
  | { kind: 'live'; address: string }
  | { kind: 'cached'; address: string; cachedAt: number }
  | { kind: 'none' };

/** Reverse geocode lỗi → server trả "lat,lng" thay cho địa chỉ: không đọc chuỗi số đó. */
const COORDINATES_ONLY = /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/;

/**
 * Bỏ phần đọc lên thừa: mã bưu chính ("71200") và quốc gia ("Việt Nam"). Chuỗi chỉ có tọa độ
 * (reverse geocode lỗi) → null, không đọc dãy số.
 */
export function usableAddress(address: string | null | undefined): string | null {
  if (!address || COORDINATES_ONLY.test(address)) return null;
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !/^\d{5,6}$/.test(p) && !/^vi[eệ]t nam$/i.test(p));
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * "Tôi đang ở đâu?" (FE-12, BR-15): online → gửi điểm GPS hiện tại, server trả địa chỉ mới nhất;
 * không bắt được GPS → địa chỉ server lưu gần nhất (`/locations/me`). Offline / lỗi → cache trên máy.
 */
export async function whereAmI(deps: WhereAmIDeps): Promise<WhereAmIResult> {
  if (deps.isOnline()) {
    try {
      const point = await deps.currentPoint();
      if (point) {
        const address = usableAddress(await deps.recordGps(point));
        if (address) {
          await deps
            .saveCache({
              latitude: point.latitude,
              longitude: point.longitude,
              address,
              cachedAt: deps.now(),
            })
            .catch((e: unknown) => logger.warn('Save location cache failed', e));
          return { kind: 'live', address };
        }
      } else {
        const server = await deps.fetchMyLocation();
        const address = usableAddress(server.formattedAddress);
        if (address) return { kind: 'cached', address, cachedAt: Date.parse(server.cachedAt) };
      }
    } catch (e) {
      // 404 từ /locations/me = server chưa có vị trí → xem cache trên máy
      if (!(e instanceof ApiError && e.status === 404)) logger.warn('Where am I online failed', e);
    }
  }
  const cached = await deps.readCache().catch(() => null);
  return cached
    ? { kind: 'cached', address: cached.address, cachedAt: cached.cachedAt }
    : { kind: 'none' };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Câu TTS: địa chỉ cũ luôn kèm thời điểm + cảnh báo có thể không còn chính xác (BR-15). */
export function describeWhereAmI(result: WhereAmIResult): string {
  switch (result.kind) {
    case 'live':
      return Strings.location.here(result.address);
    case 'cached': {
      const d = new Date(result.cachedAt);
      return Strings.location.cached(
        `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        d.getDate(),
        d.getMonth() + 1,
        result.address,
      );
    }
    case 'none':
      return Strings.location.none;
  }
}
