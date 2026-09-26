import { useEffect } from 'react';

import { getTokens } from '@/services/storage/secureStorage';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';

/** Kiểm tra token lúc khởi động và quyết định màn hình đầu tiên. */
export function useAuthBootstrap(): void {
  const signOut = useAuthStore((s) => s.signOut);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      try {
        const tokens = await getTokens();
        if (cancelled) return;
        if (!tokens) {
          signOut();
          return;
        }
        // TODO(Sprint 2): GET /api/users/me → kiểm tra role VIU + privacy consent → setUser()
        signOut();
      } catch (error) {
        logger.error('Auth bootstrap failed', error);
        if (!cancelled) signOut();
      }
    }

    void bootstrapAuth();
    return () => {
      cancelled = true;
    };
  }, [signOut]);
}
