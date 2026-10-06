import { ApiError } from '@/api/client';

import { classifySyncError } from './syncError';

const e = (status: number) => new ApiError(status, '', '');

describe('classifySyncError', () => {
  it('lỗi tạm → retry; dữ liệu sai / đã có trên server → drop; không còn → gone', () => {
    expect(classifySyncError(e(0))).toBe('retry');
    expect(classifySyncError(e(402))).toBe('retry');
    expect(classifySyncError(e(503))).toBe('retry');
    expect(classifySyncError(e(409))).toBe('drop');
    expect(classifySyncError(e(422))).toBe('drop');
    expect(classifySyncError(e(404))).toBe('gone');
    expect(classifySyncError(new Error('x'))).toBe('retry');
  });
});
