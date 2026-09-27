import type { ExpoConfig } from 'expo/config';

const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
const IS_DEV = APP_ENV === 'development';

const config: ExpoConfig = {
  name: IS_DEV ? 'VisionAid (Dev)' : 'VisionAid',
  slug: 'visionaid-mobile',
  scheme: 'visionaid',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0B0B0C', // nền gốc (expo-system-ui) — tránh chớp trắng khi chuyển màn
  android: {
    package: IS_DEV ? 'vn.visionaid.mobile.dev' : 'vn.visionaid.mobile',
    adaptiveIcon: {
      backgroundColor: '#0B0B0C',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // CLAUDE.md mục 14
    permissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
      'android.permission.FOREGROUND_SERVICE_CAMERA',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.CALL_PHONE',
      'android.permission.VIBRATE',
      'android.permission.WAKE_LOCK',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.HIGH_SAMPLING_RATE_SENSORS',
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#0B0B0C',
      },
    ],
    [
      'expo-font',
      {
        // Atkinson Hyperlegible — thiết kế cho người thị lực kém (Braille Institute).
        // Nhúng lúc build: không nháy font, không cần tải lúc chạy.
        fonts: [
          './node_modules/@expo-google-fonts/atkinson-hyperlegible/400Regular/AtkinsonHyperlegible_400Regular.ttf',
          './node_modules/@expo-google-fonts/atkinson-hyperlegible/700Bold/AtkinsonHyperlegible_700Bold.ttf',
        ],
      },
    ],
    'expo-secure-store',
    'expo-sqlite',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'VisionAid cần vị trí để chia sẻ với người chăm sóc và báo khi bạn đến nơi quen thuộc.',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 29, // Android 10
          // Chỉ cho phép HTTP cleartext ở build development (backend local)
          usesCleartextTraffic: IS_DEV,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appEnv: APP_ENV,
  },
};

export default config;
