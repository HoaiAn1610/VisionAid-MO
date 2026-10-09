import { AppState } from 'react-native';

import { ApiError } from '@/api/client';
import { fetchEmergencyContacts } from '@/api/endpoints/emergency';
import { saveEmergencyContacts } from '@/services/storage/emergencyContactsRepo';
import { logger } from '@/utils/logger';

function refreshEmergencyContacts(): void {
  fetchEmergencyContacts()
    .then(saveEmergencyContacts)
    .catch((e: unknown) =>
      // Mất mạng (status 0): giữ cache cũ, lần mở app sau tải lại — không phải lỗi
      (e instanceof ApiError && e.status === 0 ? logger.debug : logger.warn)(
        'Refresh emergency contacts failed',
        e instanceof ApiError ? e.status : e,
      ),
    );
}

/**
 * Tải danh bạ khẩn cấp vào cache SQLite khi mở app và mỗi lần app trở lại foreground — Caregiver có
 * thể đổi số trên web trong lúc app đang mở; SOS đọc cache nên chạy được cả offline. Trả hàm dừng.
 */
export function startEmergencyContactsRefresh(): () => void {
  refreshEmergencyContacts();
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') refreshEmergencyContacts();
  });
  return () => sub.remove();
}
