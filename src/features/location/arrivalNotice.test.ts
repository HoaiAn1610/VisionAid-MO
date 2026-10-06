import { Strings } from '@/constants/strings.vi';

import {
  arrivalFromFcmData,
  createArrivalAnnouncer,
  type ArrivalNotification,
} from './arrivalNotice';

const event = (over: Partial<ArrivalNotification> = {}): ArrivalNotification => ({
  viuId: 'viu',
  savedLocationId: 'home',
  savedLocationName: 'Nhà',
  ttsAnnouncement: null,
  latitude: 10.7,
  longitude: 106.7,
  occurredAt: '2026-10-06T08:00:00+07:00',
  ...over,
});

describe('createArrivalAnnouncer', () => {
  it('đọc tên địa điểm + lời nhắn của người chăm sóc', () => {
    const say = jest.fn();
    createArrivalAnnouncer(say)(event({ ttsAnnouncement: 'Nhớ cởi giày' }));
    expect(say).toHaveBeenCalledWith(Strings.location.arrived('Nhà', 'Nhớ cởi giày'));
  });

  it('cùng sự kiện từ SignalR và FCM (khác định dạng giờ) → chỉ đọc một lần', () => {
    const say = jest.fn();
    const announce = createArrivalAnnouncer(say);
    expect(announce(event())).toBe(true);
    expect(announce(event({ occurredAt: '2026-10-06T01:00:00Z' }))).toBe(false);
    expect(say).toHaveBeenCalledTimes(1);
  });

  it('lần đến sau (thời điểm khác) hoặc nơi khác → đọc tiếp', () => {
    const say = jest.fn();
    const announce = createArrivalAnnouncer(say);
    announce(event());
    announce(event({ occurredAt: '2026-10-06T18:00:00+07:00' }));
    announce(event({ savedLocationId: 'school', savedLocationName: 'Trường' }));
    expect(say).toHaveBeenCalledTimes(3);
  });
});

describe('arrivalFromFcmData', () => {
  const data = {
    notificationType: 'ArrivalNotification',
    savedLocationId: 'home',
    savedLocationName: 'Nhà',
    ttsAnnouncement: '',
    occurredAt: '2026-10-06T08:00:00+07:00',
  };

  it('đủ field → sự kiện, chuỗi rỗng thành null', () => {
    expect(arrivalFromFcmData(data)).toMatchObject({
      savedLocationId: 'home',
      savedLocationName: 'Nhà',
      ttsAnnouncement: null,
    });
  });

  it('loại thông báo khác / payload cũ thiếu tên nơi / giờ sai → null', () => {
    expect(arrivalFromFcmData({ ...data, notificationType: 'FallDetected' })).toBeNull();
    expect(
      arrivalFromFcmData({ notificationType: 'ArrivalNotification', notificationId: 'x' }),
    ).toBeNull();
    expect(arrivalFromFcmData({ ...data, occurredAt: 'abc' })).toBeNull();
    expect(arrivalFromFcmData(undefined)).toBeNull();
  });
});
