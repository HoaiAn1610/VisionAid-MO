import { ApiError } from '@/api/client';
import type { GpsPoint } from '@/api/endpoints/locations';
import { Strings } from '@/constants/strings.vi';

import { describeWhereAmI, usableAddress, whereAmI, type WhereAmIDeps } from './whereAmI';

const point: GpsPoint = {
  clientGeneratedId: 'id-1',
  latitude: 10.77,
  longitude: 106.7,
  accuracyMeters: 8,
  altitude: null,
  speedMps: null,
  heading: null,
  batteryLevel: 80,
  networkStatus: 'Wifi',
  recordedAt: '2026-10-03T08:00:00.000Z',
};
const cached = { latitude: 1, longitude: 2, address: '1 Lê Lợi, Quận 1', cachedAt: 1_000 };

const deps = (over: Partial<WhereAmIDeps> = {}): WhereAmIDeps => ({
  isOnline: () => true,
  currentPoint: jest.fn(async () => point),
  recordGps: jest.fn(async () => '12 Nguyễn Huệ, Quận 1'),
  fetchMyLocation: jest.fn(async () => ({
    formattedAddress: '5 Hai Bà Trưng',
    cachedAt: '2026-10-03T07:00:00+07:00',
  })),
  readCache: jest.fn(async () => cached),
  saveCache: jest.fn(async () => {}),
  now: () => 5_000,
  ...over,
});

describe('whereAmI', () => {
  it('online + có GPS → địa chỉ mới từ server, lưu cache', async () => {
    const d = deps();
    await expect(whereAmI(d)).resolves.toEqual({ kind: 'live', address: '12 Nguyễn Huệ, Quận 1' });
    expect(d.saveCache).toHaveBeenCalledWith({
      latitude: 10.77,
      longitude: 106.7,
      address: '12 Nguyễn Huệ, Quận 1',
      cachedAt: 5_000,
    });
  });

  it('online nhưng không bắt được GPS → địa chỉ server lưu gần nhất, kèm thời điểm', async () => {
    const d = deps({ currentPoint: jest.fn(async () => null) });
    await expect(whereAmI(d)).resolves.toEqual({
      kind: 'cached',
      address: '5 Hai Bà Trưng',
      cachedAt: Date.parse('2026-10-03T07:00:00+07:00'),
    });
  });

  it('server chỉ trả tọa độ (geocode lỗi) → không đọc số, dùng cache trên máy', async () => {
    const d = deps({ recordGps: jest.fn(async () => '10.770000,106.700000') });
    await expect(whereAmI(d)).resolves.toEqual({ kind: 'cached', ...pick(cached) });
    expect(d.saveCache).not.toHaveBeenCalled();
  });

  it('offline → cache trên máy, không gọi mạng', async () => {
    const d = deps({ isOnline: () => false });
    await expect(whereAmI(d)).resolves.toEqual({ kind: 'cached', ...pick(cached) });
    expect(d.recordGps).not.toHaveBeenCalled();
  });

  it('lỗi mạng / server chưa có vị trí (404) và không có cache → none', async () => {
    const d = deps({
      currentPoint: jest.fn(async () => null),
      fetchMyLocation: jest.fn(async () => {
        throw new ApiError(404, 'Not Found', '');
      }),
      readCache: jest.fn(async () => null),
    });
    await expect(whereAmI(d)).resolves.toEqual({ kind: 'none' });
  });
});

describe('describeWhereAmI', () => {
  it('địa chỉ cũ luôn kèm giờ, ngày và cảnh báo (BR-15)', () => {
    const at = new Date(2026, 9, 3, 7, 5).getTime();
    expect(describeWhereAmI({ kind: 'cached', address: 'Chợ Bến Thành', cachedAt: at })).toBe(
      Strings.location.cached('07:05', 3, 10, 'Chợ Bến Thành'),
    );
    expect(describeWhereAmI({ kind: 'live', address: 'Chợ Bến Thành' })).toBe(
      'Bạn đang ở Chợ Bến Thành',
    );
    expect(describeWhereAmI({ kind: 'none' })).toBe(Strings.location.none);
  });

  it('usableAddress bỏ chuỗi chỉ có tọa độ', () => {
    expect(usableAddress('10.77, 106.7')).toBeNull();
    expect(usableAddress('Quận 1')).toBe('Quận 1');
    expect(usableAddress(null)).toBeNull();
    expect(usableAddress('Hẻm 306, 71200, Long Trường, Thành phố Hồ Chí Minh, Việt Nam')).toBe(
      'Hẻm 306, Long Trường, Thành phố Hồ Chí Minh',
    );
  });
});

function pick(c: typeof cached) {
  return { address: c.address, cachedAt: c.cachedAt };
}
