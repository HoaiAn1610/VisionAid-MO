/** Role trong API và JWT đều là PascalCase (`user.Role.ToString()` ở backend). */
export function isVisuallyImpaired(role: string | null | undefined): boolean {
  return role === 'VisuallyImpaired';
}
