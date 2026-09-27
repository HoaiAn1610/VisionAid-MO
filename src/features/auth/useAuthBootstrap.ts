import { useEffect } from 'react';

import { bootstrapAuth, registerSessionExpiredHandler } from './authService';

/** Gọi 1 lần ở root layout: đăng ký xử lý hết phiên + quyết định màn hình đầu tiên. */
export function useAuthBootstrap(): void {
  useEffect(() => {
    registerSessionExpiredHandler();
    void bootstrapAuth();
  }, []);
}
