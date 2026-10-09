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
    // Firebase (FCM) — file không commit (.gitignore), lấy từ project của backend
    googleServicesFile: './google-services.json',
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
      // expo-task-manager lưu lịch task GPS nền qua JobScheduler (persisted job)
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.MODIFY_AUDIO_SETTINGS', // loa ngoài khi gọi WebRTC
    ],
  },
  plugins: [
    'expo-router',
    '@react-native-firebase/app',
    '@react-native-firebase/messaging',
    '@config-plugins/react-native-webrtc',
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
    [
      'react-native-vision-camera',
      {
        cameraPermissionText:
          'VisionAid dùng camera để phát hiện vật cản trên đường đi. Hình ảnh được xử lý ngay trên điện thoại.',
        enableMicrophonePermission: false,
        enableFrameProcessors: true,
        enableCodeScanner: true, // quét QR on-device (Sprint 5)
      },
    ],
    // GPU delegate cho TFLite trên Android (libOpenCL.so, không bắt buộc có)
    ['react-native-fast-tflite', { enableAndroidGpuLibraries: true }],
    'expo-secure-store',
    'expo-sqlite',
    [
      'expo-speech-recognition',
      {
        microphonePermission: 'VisionAid cần micro để nhận lệnh giọng nói.',
        speechRecognitionPermission: 'VisionAid cần nhận dạng giọng nói để hiểu lệnh của bạn.',
        androidSpeechServicePackages: [
          'com.google.android.googlequicksearchbox',
          'com.google.android.tts',
        ],
      },
    ],
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
