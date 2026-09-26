import * as SQLite from 'expo-sqlite';

const DB_NAME = 'visionaid.db';

// Mỗi phần tử = 1 migration, chạy theo thứ tự, lưu version trong PRAGMA user_version.
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE IF NOT EXISTS pending_emergency_events (
    id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS pending_gps (
    id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS pending_detection_events (
    id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS pending_voice_logs (
    id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS pending_qr_logs (
    id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS location_cache (
    id INTEGER PRIMARY KEY CHECK (id = 1), latitude REAL NOT NULL, longitude REAL NOT NULL,
    formatted_address TEXT NOT NULL, cached_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS emergency_contacts (
    id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, phone TEXT, contact_type TEXT NOT NULL,
    priority_order INTEGER NOT NULL
  );
  `,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= openAndMigrate().catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version++) {
    const sql = MIGRATIONS[version];
    if (sql === undefined) break;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
  return db;
}

/** Xóa dữ liệu người dùng khi logout (giữ schema). */
export async function clearUserData(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM pending_gps; DELETE FROM pending_detection_events; DELETE FROM pending_voice_logs;
    DELETE FROM pending_qr_logs; DELETE FROM location_cache; DELETE FROM emergency_contacts;
  `);
}
