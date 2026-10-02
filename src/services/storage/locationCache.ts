import { getDb } from './db';

export interface CachedLocation {
  latitude: number;
  longitude: number;
  address: string;
  /** epoch ms */
  cachedAt: number;
}

/** Địa chỉ gần nhất cho "Tôi đang ở đâu?" khi offline (BR-15). Một dòng duy nhất. */
export async function saveCachedLocation(l: CachedLocation): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO location_cache (id, latitude, longitude, formatted_address, cached_at)
     VALUES (1, ?, ?, ?, ?)`,
    l.latitude,
    l.longitude,
    l.address,
    l.cachedAt,
  );
}

export async function readCachedLocation(): Promise<CachedLocation | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    latitude: number;
    longitude: number;
    formatted_address: string;
    cached_at: number;
  }>('SELECT latitude, longitude, formatted_address, cached_at FROM location_cache WHERE id = 1');
  return row
    ? {
        latitude: row.latitude,
        longitude: row.longitude,
        address: row.formatted_address,
        cachedAt: row.cached_at,
      }
    : null;
}
