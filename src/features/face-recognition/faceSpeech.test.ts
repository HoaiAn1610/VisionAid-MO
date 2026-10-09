import { ApiError } from '@/api/client';
import { Strings } from '@/constants/strings.vi';

import { describeFaceError, describeIdentification } from './faceSpeech';

describe('describeIdentification', () => {
  it('nhận ra → tên + quan hệ', () => {
    expect(
      describeIdentification({
        recognized: true,
        lowConfidence: false,
        matchedPersonName: 'Lan',
        relationship: 'Mẹ',
      }),
    ).toBe('Lan, Mẹ, ở phía trước');
    expect(
      describeIdentification({
        recognized: true,
        lowConfidence: false,
        matchedPersonName: 'Lan',
        relationship: ' ',
      }),
    ).toBe('Lan ở phía trước');
  });

  it('không nhận ra hoặc thiếu tên → "Không nhận ra người này"', () => {
    expect(
      describeIdentification({
        recognized: false,
        lowConfidence: false,
        matchedPersonName: null,
        relationship: null,
      }),
    ).toBe(Strings.face.notMatched);
    expect(
      describeIdentification({
        recognized: true,
        lowConfidence: false,
        matchedPersonName: '',
        relationship: null,
      }),
    ).toBe(Strings.face.notMatched);
  });
});

describe('lowConfidence', () => {
  it('gần ngưỡng → yêu cầu hướng thẳng camera, không đoán tên', () => {
    expect(
      describeIdentification({
        recognized: false,
        lowConfidence: true,
        matchedPersonName: null,
        relationship: null,
      }),
    ).toBe(Strings.face.lowConfidence);
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
    expect(describeFaceError(new E(422), true)).toBe(Strings.face.retake);
    expect(describeFaceError(new E(500), true)).toBe(Strings.face.unavailable);
    // 422 có errorCode = FaceNet không chạy (không phải lỗi ảnh) → không bảo người dùng chụp lại
    expect(
      describeFaceError(new ApiError(422, '', '', undefined, 'FACE_SERVICE_UNAVAILABLE'), true),
    ).toBe(Strings.face.unavailable);
    expect(describeFaceError(new Error('x'), true)).toBe(Strings.face.unavailable);
  });
});
