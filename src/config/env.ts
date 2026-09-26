// Biến EXPO_PUBLIC_* được inline lúc build — phải truy cập trực tiếp theo tên đầy đủ.
export const Env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:5000',
  signalRUrl: process.env.EXPO_PUBLIC_SIGNALR_URL ?? 'http://10.0.2.2:5000/hubs/location',
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
  privacyPolicyVersion: process.env.EXPO_PUBLIC_PRIVACY_POLICY_VERSION ?? '1.0',
} as const;

export const IS_PRODUCTION = Env.appEnv === 'production';
