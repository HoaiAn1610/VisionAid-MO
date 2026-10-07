import { crossedLowBattery } from './lowBattery';

describe('crossedLowBattery (BR-17)', () => {
  it('tụt dưới 10% lần đầu → vào chế độ tiết kiệm; vẫn thấp → không báo lại', () => {
    expect(crossedLowBattery(false, 0.09)).toEqual({ low: true, enter: true });
    expect(crossedLowBattery(true, 0.05)).toEqual({ low: true, enter: false });
  });

  it('sạc lên lại trên ngưỡng rồi tụt tiếp → báo lần nữa', () => {
    expect(crossedLowBattery(true, 0.3)).toEqual({ low: false, enter: false });
    expect(crossedLowBattery(false, 0.08)).toEqual({ low: true, enter: true });
  });

  it('10% chưa tính là pin yếu; máy không đọc được pin → giữ nguyên', () => {
    expect(crossedLowBattery(false, 0.1)).toEqual({ low: false, enter: false });
    expect(crossedLowBattery(true, -1)).toEqual({ low: true, enter: false });
  });
});
