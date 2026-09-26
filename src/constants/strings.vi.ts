// TẤT CẢ câu TTS / label tiếng Việt — không hard-code trong component.
export const Strings = {
  app: {
    ready: "VisionAid đã sẵn sàng. Chạm hai lần hoặc nói 'bắt đầu' để dẫn đường.",
    loading: 'Đang tải',
  },
  auth: {
    loginTitle: 'Đăng nhập',
    emailLabel: 'Email',
    passwordLabel: 'Mật khẩu',
    loginButton: 'Đăng nhập',
    loginHint: 'Chạm hai lần để đăng nhập',
    wrongRole:
      'Tài khoản này không dùng được trên ứng dụng di động. Vui lòng dùng trang web quản lý.',
    sessionExpired: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    devBypass: 'Vào màn hình chính (dev)',
    devBypassHint: 'Chỉ có ở bản phát triển. Chạm hai lần để vào màn hình chính bằng tài khoản giả',
  },
  privacy: {
    title: 'Chính sách bảo mật',
    acceptButton: 'Tôi đồng ý',
    acceptHint: 'Chạm hai lần để đồng ý chính sách bảo mật và tiếp tục',
  },
  screens: {
    ocr: 'Đọc chữ và mã QR',
    face: 'Nhận diện người quen',
    location: 'Tôi đang ở đâu',
    emergency: 'Khẩn cấp',
    settings: 'Cài đặt',
    notImplemented: 'Tính năng đang được phát triển',
  },
  home: {
    title: 'Màn hình chính',
    startNavigation: 'Bắt đầu dẫn đường',
    startNavigationHint: 'Chạm hai lần để bắt đầu phát hiện vật cản',
  },
  errors: {
    forbidden: 'Bạn không có quyền thực hiện thao tác này',
    unavailable: 'Tính năng tạm thời không khả dụng',
    ocrNeedsNetwork: 'Tính năng đọc chữ cần kết nối mạng',
    faceNeedsNetwork: 'Tính năng nhận diện người quen cần kết nối mạng',
  },
  distance: {
    Near: 'ở gần',
    Medium: 'phía trước',
    Far: 'ở xa',
  },
} as const;
