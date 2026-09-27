import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { ApiError, apiClient, refreshClient, setSessionExpiredHandler } from './client';

// In-memory SecureStore thay cho native module
const store: { tokens: { accessToken: string; refreshToken: string } | null } = { tokens: null };
jest.mock('@/services/storage/secureStorage', () => ({
  getTokens: jest.fn(async () => store.tokens),
  saveTokens: jest.fn(async (t: { accessToken: string; refreshToken: string }) => {
    store.tokens = t;
  }),
  clearTokens: jest.fn(async () => {
    store.tokens = null;
  }),
  getOrCreateClientDeviceId: jest.fn(async () => 'device-1'),
}));

type Handler = (config: InternalAxiosRequestConfig) => { status: number; data?: unknown };

function respond(config: InternalAxiosRequestConfig, status: number, data?: unknown) {
  const response: AxiosResponse = {
    data,
    status,
    statusText: String(status),
    headers: {},
    config,
  };
  if (status >= 400) {
    throw new AxiosError(`HTTP ${status}`, AxiosError.ERR_BAD_RESPONSE, config, null, response);
  }
  return response;
}

function useApi(handler: Handler) {
  apiClient.defaults.adapter = async (config) => {
    const { status, data } = handler(config);
    return respond(config, status, data);
  };
}

function useRefresh(handler: Handler) {
  refreshClient.defaults.adapter = async (config) => {
    await new Promise((r) => setTimeout(r, 5)); // để các request 401 kịp dồn lại
    const { status, data } = handler(config);
    return respond(config, status, data);
  };
}

const bearer = (c: InternalAxiosRequestConfig) =>
  AxiosHeaders.from(c.headers as AxiosHeaders).get('Authorization');

const tokenResponse = (access: string, refresh: string) => ({
  success: true,
  message: 'Success',
  data: {
    accessToken: access,
    refreshToken: refresh,
    expiresAt: '2026-10-27T10:00:00+07:00',
    userId: '0199a1b2-0000-7000-8000-000000000001',
    email: 'viu@visionaid.vn',
    role: 'VisuallyImpaired',
    organizationId: null,
  },
  errors: [],
});

describe('apiClient', () => {
  let onExpired: jest.Mock;

  beforeEach(() => {
    store.tokens = { accessToken: 'old-access', refreshToken: 'old-refresh' };
    onExpired = jest.fn();
    setSessionExpiredHandler(onExpired);
  });

  it('gắn Bearer access token vào request', async () => {
    let seen: unknown;
    useApi((c) => {
      seen = bearer(c);
      return { status: 200, data: { success: true } };
    });
    await apiClient.get('/api/users/me');
    expect(seen).toBe('Bearer old-access');
  });

  it('nhiều request cùng 401 → chỉ refresh MỘT lần, lưu cặp token mới, retry tất cả', async () => {
    useApi((c) =>
      bearer(c) === 'Bearer new-access'
        ? { status: 200, data: { success: true, data: c.url } }
        : { status: 401 },
    );
    const refreshBodies: unknown[] = [];
    useRefresh((c) => {
      refreshBodies.push(JSON.parse(c.data as string));
      return { status: 200, data: tokenResponse('new-access', 'new-refresh') };
    });

    const results = await Promise.all([
      apiClient.get('/a'),
      apiClient.get('/b'),
      apiClient.get('/c'),
    ]);

    expect(results.map((r) => r.data.data)).toEqual(['/a', '/b', '/c']);
    expect(refreshBodies).toEqual([{ refreshToken: 'old-refresh', clientDeviceId: 'device-1' }]);
    expect(store.tokens).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('refresh trả 403 → xóa token, gọi session-expired đúng một lần, request lỗi 401', async () => {
    useApi(() => ({ status: 401 }));
    useRefresh(() => ({
      status: 403,
      data: { type: 't', title: 'Forbidden', status: 403, detail: 'Refresh token reuse detected.' },
    }));

    const results = await Promise.allSettled([apiClient.get('/a'), apiClient.get('/b')]);

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    const reason = (results[0] as PromiseRejectedResult).reason as ApiError;
    expect(reason).toBeInstanceOf(ApiError);
    expect(reason.status).toBe(401);
    expect(store.tokens).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('request retry vẫn 401 → không refresh lần hai (không lặp vô hạn)', async () => {
    useApi(() => ({ status: 401 }));
    let refreshCalls = 0;
    useRefresh(() => {
      refreshCalls++;
      return { status: 200, data: tokenResponse('new-access', 'new-refresh') };
    });

    await expect(apiClient.get('/a')).rejects.toMatchObject({ status: 401 });
    expect(refreshCalls).toBe(1);
  });

  it('refresh lỗi MẠNG → request báo lỗi mạng (status 0), giữ phiên, không báo hết phiên', async () => {
    useApi(() => ({ status: 401 }));
    refreshClient.defaults.adapter = async (config) => {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    };

    await expect(apiClient.get('/a')).rejects.toMatchObject({ status: 0 });
    expect(store.tokens).toEqual({ accessToken: 'old-access', refreshToken: 'old-refresh' });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('401 của request dùng token CŨ khi token đã được làm mới → retry luôn, không refresh thêm', async () => {
    store.tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
    useApi((c) =>
      bearer(c) === 'Bearer new-access' ? { status: 200, data: { ok: true } } : { status: 401 },
    );
    const refresh = jest.fn(() => ({ status: 200 }));
    useRefresh(refresh);

    // Mô phỏng request đã gửi đi với token cũ trước khi refresh xong
    const res = await apiClient.get('/a', { headers: { Authorization: 'Bearer old-access' } });

    expect(res.data).toEqual({ ok: true });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('chưa có phiên (vd. login sai mật khẩu) → không refresh, không báo hết phiên', async () => {
    store.tokens = null;
    useApi(() => ({
      status: 401,
      data: { success: false, errors: ['Invalid email or password.'] },
    }));
    const refresh = jest.fn(() => ({ status: 200 }));
    useRefresh(refresh);

    await expect(apiClient.post('/api/auth/login', {})).rejects.toMatchObject({
      status: 401,
      detail: 'Invalid email or password.',
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
  });
});

describe('chuẩn hóa lỗi → ApiError', () => {
  beforeEach(() => {
    store.tokens = { accessToken: 'a', refreshToken: 'r' };
  });

  it('ProblemDetails 400 → fieldErrors', async () => {
    useApi(() => ({
      status: 400,
      data: {
        type: 't',
        title: 'Validation Error',
        status: 400,
        detail: 'One or more validation errors occurred.',
        errors: { Email: ['Invalid email format.'] },
      },
    }));
    await expect(apiClient.post('/x', {})).rejects.toMatchObject({
      status: 400,
      title: 'Validation Error',
      fieldErrors: { Email: ['Invalid email format.'] },
    });
  });

  it('ApiResponse success:false → detail lấy từ errors[]', async () => {
    useApi(() => ({
      status: 400,
      data: { success: false, message: '', data: null, errors: ['A', 'B'] },
    }));
    await expect(apiClient.post('/x', {})).rejects.toMatchObject({ status: 400, detail: 'A; B' });
  });

  it('422 Business Rule Violation giữ nguyên title', async () => {
    useApi(() => ({
      status: 422,
      data: {
        type: 't',
        title: 'Business Rule Violation',
        status: 422,
        detail: 'Grace period has expired.',
      },
    }));
    await expect(apiClient.put('/x', {})).rejects.toMatchObject({
      status: 422,
      title: 'Business Rule Violation',
    });
  });

  it('lỗi mạng / timeout → status 0', async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    };
    await expect(apiClient.get('/x')).rejects.toMatchObject({ status: 0 });
  });
});
