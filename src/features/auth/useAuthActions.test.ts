import { Strings } from '@/constants/strings.vi';

import { loginFormSchema } from './useAuthActions';

jest.mock('./authService', () => ({}));
jest.mock('@/services/tts/TtsService', () => ({ TtsPriority: {}, ttsService: {} }));
jest.mock('@/services/haptics/HapticService', () => ({ HapticService: {} }));

describe('loginFormSchema', () => {
  const firstError = (input: unknown) => {
    const r = loginFormSchema.safeParse(input);
    return r.success ? null : r.error.issues[0]?.message;
  };

  it('email sai định dạng → câu tiếng Việt', () => {
    expect(firstError({ email: 'abc', password: 'x' })).toBe(Strings.auth.invalidEmail);
  });

  it('thiếu mật khẩu → câu tiếng Việt', () => {
    expect(firstError({ email: 'viu@visionaid.vn', password: '' })).toBe(
      Strings.auth.passwordRequired,
    );
  });

  it('hợp lệ', () => {
    expect(firstError({ email: 'viu@visionaid.vn', password: 'x' })).toBeNull();
  });
});
