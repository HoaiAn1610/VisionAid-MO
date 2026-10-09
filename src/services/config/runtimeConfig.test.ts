import { apiClient } from '@/api/client';

import {
  configBool,
  configNumber,
  loadRuntimeConfig,
  setRuntimeConfigForTest,
} from './runtimeConfig';

jest.mock('@/api/client', () => ({ apiClient: { get: jest.fn() } }));

const page = (items: [string, string][], hasNextPage: boolean) => ({
  data: {
    success: true,
    message: '',
    errors: [],
    data: {
      items: items.map(([configKey, configValue]) => ({ configKey, configValue })),
      hasNextPage,
    },
  },
});

beforeEach(() => setRuntimeConfigForTest({}));

describe('runtimeConfig', () => {
  it('đọc hết các trang, ép kiểu số / bool', async () => {
    (apiClient.get as jest.Mock)
      .mockResolvedValueOnce(page([['navigation_near_threshold_ms', '800']], true))
      .mockResolvedValueOnce(page([['hybrid_navigation_enabled', 'False']], false));
    await loadRuntimeConfig();
    expect(configNumber('navigation_near_threshold_ms', 500)).toBe(800);
    expect(configBool('hybrid_navigation_enabled', true)).toBe(false);
  });

  it('server lỗi / thiếu key / giá trị hỏng → mặc định trong app', async () => {
    (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await loadRuntimeConfig();
    expect(configNumber('navigation_near_threshold_ms', 500)).toBe(500);
    setRuntimeConfigForTest({ webrtc_ring_timeout_seconds: 'abc', webrtc_enabled: 'yes' });
    expect(configNumber('webrtc_ring_timeout_seconds', 45)).toBe(45);
    expect(configBool('webrtc_enabled', true)).toBe(true);
  });
});
