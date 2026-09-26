import { create } from 'zustand';

// Token KHÔNG nằm trong store — chỉ trong SecureStore. Store chỉ giữ trạng thái điều hướng.
export type AuthStatus = 'loading' | 'signedOut' | 'needsConsent' | 'signedIn';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  privacyConsentAcceptedAt: string | null;
}

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  setUser: (user: AuthUser) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  setUser: (user) =>
    set({ user, status: user.privacyConsentAcceptedAt ? 'signedIn' : 'needsConsent' }),
  signOut: () => set({ user: null, status: 'signedOut' }),
}));
