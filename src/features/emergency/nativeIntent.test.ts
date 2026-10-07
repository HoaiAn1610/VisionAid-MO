import { redirectSystemPath } from '../../../app/+native-intent';

describe('redirectSystemPath', () => {
  it('deep link vào màn khẩn cấp → về màn chính', () => {
    for (const path of ['/emergency?via=voice', 'emergency', 'visionaid://emergency?via=voice']) {
      expect(redirectSystemPath({ path, initial: false })).toBe('/');
    }
  });

  it('đường dẫn khác giữ nguyên', () => {
    expect(redirectSystemPath({ path: '/location', initial: true })).toBe('/location');
  });
});
