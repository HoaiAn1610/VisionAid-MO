import { consumeSosConfirmation, markSosConfirmedByVoice } from './sosConfirmation';

describe('sosConfirmation', () => {
  it('chưa xác nhận bằng giọng nói (ví dụ mở bằng deep link) → false', () => {
    expect(consumeSosConfirmation(1000)).toBe(false);
  });

  it('dùng được đúng một lần, trong 5 giây', () => {
    markSosConfirmedByVoice(1000);
    expect(consumeSosConfirmation(3000)).toBe(true);
    expect(consumeSosConfirmation(3000)).toBe(false);
    markSosConfirmedByVoice(1000);
    expect(consumeSosConfirmation(7000)).toBe(false);
  });
});
