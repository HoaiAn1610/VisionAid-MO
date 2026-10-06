import { fetchEmergencyContacts } from '@/api/endpoints/emergency';
import { saveEmergencyContacts } from '@/services/storage/emergencyContactsRepo';
import { logger } from '@/utils/logger';

/** Tải danh bạ khẩn cấp và cache vào SQLite (gọi khi mở app) — SOS đọc cache, chạy được offline. */
export function refreshEmergencyContacts(): void {
  fetchEmergencyContacts()
    .then(saveEmergencyContacts)
    .catch((e: unknown) => logger.warn('Refresh emergency contacts failed', e));
}
