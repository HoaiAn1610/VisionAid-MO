import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  accessToken: 'va_access_token',
  refreshToken: 'va_refresh_token',
  clientDeviceId: 'va_client_device_id',
  cachedUser: 'va_cached_user',
} as const;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function getTokens(): Promise<TokenPair | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(KEYS.accessToken),
    SecureStore.getItemAsync(KEYS.refreshToken),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

/** Luôn lưu CẢ cặp mới — refresh token cũ đã bị revoke ở server (BR-34). */
export async function saveTokens(tokens: TokenPair): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.accessToken, tokens.accessToken),
    SecureStore.setItemAsync(KEYS.refreshToken, tokens.refreshToken),
  ]);
}

/** Xóa token + profile cache khi logout / hết phiên — GIỮ clientDeviceId. */
export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.accessToken),
    SecureStore.deleteItemAsync(KEYS.refreshToken),
    SecureStore.deleteItemAsync(KEYS.cachedUser),
  ]);
}

/** Profile gần nhất (JSON) để mở app khi offline — không chứa token. */
export async function getCachedUser(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.cachedUser);
}

export async function saveCachedUser(json: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.cachedUser, json);
}

/** UUID v4 sinh một lần khi cài app, dùng chung cho refresh token và FCM token. */
export async function getOrCreateClientDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEYS.clientDeviceId);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(KEYS.clientDeviceId, id);
  return id;
}
