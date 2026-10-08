import { BusinessRules } from '@/constants/businessRules';
import { Strings } from '@/constants/strings.vi';

const MAX_LENGTH = 100;

/**
 * Kiểm tra trên máy theo đúng `ChangePasswordValidator` của backend — báo lỗi bằng giọng nói ngay,
 * không phải chờ server. Trả câu lỗi tiếng Việt, hoặc null nếu hợp lệ.
 */
export function validatePasswordChange(
  current: string,
  next: string,
  confirm: string,
): string | null {
  if (!current || !next || !confirm) return Strings.password.empty;
  if (next.length < BusinessRules.PASSWORD_MIN_LENGTH) return Strings.password.tooShort;
  if (next.length > MAX_LENGTH) return Strings.password.tooLong;
  const strong =
    /[A-Z]/.test(next) && /[a-z]/.test(next) && /[0-9]/.test(next) && /[^a-zA-Z0-9]/.test(next);
  if (!strong) return Strings.password.weak;
  if (next === current) return Strings.password.same;
  if (next !== confirm) return Strings.password.mismatch;
  return null;
}
