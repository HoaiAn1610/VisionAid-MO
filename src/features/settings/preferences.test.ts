import type { TtsPreferences } from '@/api/endpoints/users';

import { createPreferences, DEFAULT_PREFERENCES, type PreferencesDeps } from './preferences';

function setup(
  over: Partial<PreferencesDeps> = {},
  store: { value: string | null } = { value: null },
) {
  const deps: jest.Mocked<PreferencesDeps> = {
    userId: jest.fn(() => 'u1'),
    readCache: jest.fn(async () => store.value),
    writeCache: jest.fn(async (json: string) => {
      store.value = json;
    }),
    fetchRemote: jest.fn(async () => null),
    pushRemote: jest.fn(async () => undefined),
    apply: jest.fn(),
    ...over,
  } as jest.Mocked<PreferencesDeps>;
  return { p: createPreferences(deps), deps, store };
}

const remote: TtsPreferences = { speedRate: 1.5, volumeLevel: 0.8, detectionMode: 'Minimal' };

describe('preferences', () => {
  it('lần đầu (server chưa có) → mặc định', async () => {
    const { p, deps } = setup();
    await p.load();
    expect(deps.apply).toHaveBeenLastCalledWith(DEFAULT_PREFERENCES);
  });

  it('có bản trên máy → áp dụng ngay, rồi lấy bản server', async () => {
    const store = {
      value: JSON.stringify({ userId: 'u1', prefs: { ...remote, speedRate: 1.25 }, dirty: false }),
    };
    const { p, deps } = setup({ fetchRemote: jest.fn(async () => remote) }, store);
    await p.load();
    expect(deps.apply.mock.calls[0]![0].speedRate).toBe(1.25); // trước khi có mạng
    expect(deps.apply).toHaveBeenLastCalledWith(remote);
  });

  it('đổi lúc offline → lần mở sau đẩy bản trên máy lên, KHÔNG để server ghi đè', async () => {
    const store = { value: null as string | null };
    const offline = setup({ pushRemote: jest.fn().mockRejectedValue(new Error('offline')) }, store);
    await expect(offline.p.update({ speedRate: 1.75 })).resolves.toBe('local');

    const next = setup({ fetchRemote: jest.fn(async () => remote) }, store);
    await next.p.load();
    expect(next.deps.pushRemote).toHaveBeenCalledWith(expect.objectContaining({ speedRate: 1.75 }));
    expect(next.deps.fetchRemote).not.toHaveBeenCalled();
    expect(next.p.get().speedRate).toBe(1.75);
  });

  it('đổi trong lúc đang tải bản server → bản server về muộn KHÔNG ghi đè', async () => {
    let resolveRemote: (p: TtsPreferences) => void = () => undefined;
    const { p } = setup({
      fetchRemote: jest.fn(() => new Promise<TtsPreferences>((r) => (resolveRemote = r))),
    });
    const loading = p.load();
    await new Promise((r) => setImmediate(r));
    await p.update({ speedRate: 1.5 });
    resolveRemote({ speedRate: 1, volumeLevel: 1, detectionMode: 'Full' });
    await loading;
    expect(p.get().speedRate).toBe(1.5);
  });

  it('bản trên máy của tài khoản khác → bỏ qua', async () => {
    const store = { value: JSON.stringify({ userId: 'other', prefs: remote, dirty: true }) };
    const { p, deps } = setup({}, store);
    await p.load();
    expect(deps.pushRemote).not.toHaveBeenCalled();
    expect(p.get()).toEqual(DEFAULT_PREFERENCES);
  });

  it('giới hạn tốc độ / âm lượng trong khoảng hợp lệ, làm tròn', async () => {
    const { p } = setup();
    await p.update({ speedRate: 5, volumeLevel: 0.1 + 0.2 });
    expect(p.get()).toEqual({ speedRate: 2, volumeLevel: 0.3, detectionMode: 'Full' });
    await p.update({ speedRate: 0.1, volumeLevel: -1 });
    expect(p.get()).toMatchObject({ speedRate: 0.5, volumeLevel: 0 });
  });
});
