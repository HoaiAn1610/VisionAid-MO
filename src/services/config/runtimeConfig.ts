import { z } from 'zod';

import { apiClient } from '@/api/client';
import { apiResponseSchema } from '@/api/types';
import { logger } from '@/utils/logger';

const pageSchema = z.object({
  items: z.array(z.object({ configKey: z.string(), configValue: z.string() })),
  hasNextPage: z.boolean(),
});

const PAGE_SIZE = 50;
const MAX_PAGES = 10;

let values = new Map<string, string>();

/**
 * Tải config công khai (`GET /api/system-configs/public`, không cần đăng nhập) — server ghi đè mặc
 * định của app lúc chạy. Lỗi mạng → giữ giá trị đã có / mặc định trong code.
 */
export async function loadRuntimeConfig(): Promise<void> {
  try {
    const next = new Map<string, string>();
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await apiClient.get('/api/system-configs/public', {
        params: { page, pageSize: PAGE_SIZE },
      });
      const data = apiResponseSchema(pageSchema).parse(res.data).data;
      for (const c of data.items) next.set(c.configKey, c.configValue);
      if (!data.hasNextPage) break;
    }
    values = next;
  } catch (e) {
    logger.warn('Load runtime config failed, using defaults', e);
  }
}

export function configNumber(key: string, fallback: number): number {
  const n = Number(values.get(key));
  return values.has(key) && Number.isFinite(n) ? n : fallback;
}

export function configBool(key: string, fallback: boolean): boolean {
  const v = values.get(key)?.trim().toLowerCase();
  return v === 'true' ? true : v === 'false' ? false : fallback;
}

/** Chỉ dùng trong test. */
export function setRuntimeConfigForTest(entries: Record<string, string>): void {
  values = new Map(Object.entries(entries));
}
