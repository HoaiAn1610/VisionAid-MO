import { create } from 'zustand';

import type { User } from '@/api/endpoints/auth';
import { Env } from '@/config/env';

// Token KHÔNG nằm trong store — chỉ trong SecureStore. Store chỉ giữ trạng thái điều hướng.
export type AuthStatus = 'loading' | 'signedOut' | 'needsConsent' | 'signedIn';

/** Phải (đồng ý lại) khi chưa từng đồng ý hoặc đồng ý phiên bản chính sách cũ. */
export function needsPrivacyConsent(user: User): boolean {
  return !user.privacyConsentAcceptedAt || user.privacyPolicyVersion !== Env.privacyPolicyVersion;
}

interface AuthState {
  status: AuthStatus;
  user: User | null;
  setUser: (user: User) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  setUser: (user) => set({ user, status: needsPrivacyConsent(user) ? 'needsConsent' : 'signedIn' }),
  signOut: () => set({ user: null, status: 'signedOut' }),
}));
