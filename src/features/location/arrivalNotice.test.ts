import { Strings } from '@/constants/strings.vi';

import { createArrivalAnnouncer, type ArrivalNotification } from './arrivalNotice';

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
