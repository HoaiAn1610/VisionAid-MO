import { ApiError } from '@/api/client';
import { Strings } from '@/constants/strings.vi';

import { describeFaceError, describeIdentification } from './faceSpeech';

describe('describeIdentification', () => {
  it('nhận ra → tên + quan hệ', () => {
    expect(
      describeIdentification({ recognized: true, matchedPersonName: 'Lan', relationship: 'Mẹ' }),
    ).toBe('Lan, Mẹ, ở phía trước');
    expect(
      describeIdentification({ recognized: true, matchedPersonName: 'Lan', relationship: ' ' }),
    ).toBe('Lan ở phía trước');
  });

  it('không nhận ra hoặc thiếu tên → "Không nhận ra người này"', () => {
    expect(
      describeIdentification({ recognized: false, matchedPersonName: null, relationship: null }),
    ).toBe(Strings.face.notMatched);
    expect(
      describeIdentification({ recognized: true, matchedPersonName: '', relationship: null }),
    ).toBe(Strings.face.notMatched);
  });
});

describe('describeFaceError', () => {
  it('lỗi mạng khi đã mất mạng → cần kết nối; timeout / 422 / 5xx → tạm không khả dụng', () => {
    const E = class extends ApiError {
      constructor(status: number) {
        super(status, '', '');
      }
    };
    expect(describeFaceError(new E(0), false)).toBe(Strings.errors.faceNeedsNetwork);
    expect(describeFaceError(new E(0), true)).toBe(Strings.face.unavailable);
    expect(describeFaceError(new E(422), true)).toBe(Strings.face.unavailable);
    expect(describeFaceError(new Error('x'), true)).toBe(Strings.face.unavailable);
  });
});
