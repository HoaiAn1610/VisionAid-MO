import type { DbUserRole, UserRole } from '@/constants/enums';

/** Chấp nhận cả dạng JWT (PascalCase) lẫn dạng DB (SCREAMING_SNAKE_CASE). */
export function isVisuallyImpaired(
  role: UserRole | DbUserRole | string | null | undefined,
): boolean {
  return role === 'VisuallyImpaired' || role === 'VISUALLY_IMPAIRED';
}
