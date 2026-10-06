import type { EmergencyContact } from '@/api/endpoints/emergency';

import { getDb } from './db';

/** Cache danh bạ khẩn cấp để SOS gọi được cả khi offline (§9.7). Ghi đè toàn bộ mỗi lần tải. */
export async function saveEmergencyContacts(contacts: EmergencyContact[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM emergency_contacts');
    for (const c of contacts) {
      await db.runAsync(
        `INSERT INTO emergency_contacts
           (id, contact_name, contact_type, phone_number, zalo_deep_link, priority_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        c.id,
        c.contactName,
        c.contactType,
        c.phoneNumber,
        c.zaloDeepLink,
        c.priorityOrder,
      );
    }
  });
}

export async function readEmergencyContacts(): Promise<EmergencyContact[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    contact_name: string;
    contact_type: EmergencyContact['contactType'];
    phone_number: string | null;
    zalo_deep_link: string | null;
    priority_order: number;
  }>('SELECT * FROM emergency_contacts ORDER BY priority_order');
  return rows.map((r) => ({
    id: r.id,
    contactName: r.contact_name,
    contactType: r.contact_type,
    phoneNumber: r.phone_number,
    zaloDeepLink: r.zalo_deep_link,
    priorityOrder: r.priority_order,
  }));
}
