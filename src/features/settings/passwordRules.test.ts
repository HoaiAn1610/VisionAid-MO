import { Strings } from '@/constants/strings.vi';

import { validatePasswordChange } from './passwordRules';

describe('validatePasswordChange (khớp ChangePasswordValidator của backend)', () => {
  it('hợp lệ', () => {
    expect(validatePasswordChange('Old@1234', 'New@1234', 'New@1234')).toBeNull();
  });

  it.each([
    ['', 'New@1234', 'New@1234', Strings.password.empty],
    ['Old@1234', 'Ne@1', 'Ne@1', Strings.password.tooShort],
    ['Old@1234', 'newpass1!', 'newpass1!', Strings.password.weak], // thiếu chữ hoa
    ['Old@1234', 'NewPass12', 'NewPass12', Strings.password.weak], // thiếu ký tự đặc biệt
    ['Old@1234', 'Old@1234', 'Old@1234', Strings.password.same],
    ['Old@1234', 'New@1234', 'New@12345', Strings.password.mismatch],
  ])('%s → %s → lỗi', (current, next, confirm, error) => {
    expect(validatePasswordChange(current, next, confirm)).toBe(error);
  });
});
