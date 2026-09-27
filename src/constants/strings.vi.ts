// TẤT CẢ câu TTS / label tiếng Việt — không hard-code trong component.

// Chính sách bảo mật tách từng ý: màn hình hiển thị dạng danh sách, TTS đọc bản ghép (luôn khớp nhau).
// Thời hạn lưu trữ lấy từ BusinessRules.cs của backend.
const privacyIntro = 'VisionAid cần sự đồng ý của bạn trước khi sử dụng.';
const privacyPoints = {
  location:
    'Vị trí GPS được chia sẻ với người chăm sóc và dùng để báo khi bạn đến nơi quen thuộc. Lịch sử vị trí lưu 30 ngày.',
  camera: 'Camera phát hiện vật cản ngay trên điện thoại, không gửi hình ảnh lên máy chủ.',
  ocr: 'Ảnh chụp khi đọc chữ được lưu 90 ngày.',
  face: 'Nhận diện người quen dùng ảnh do người chăm sóc đăng ký. Ảnh bạn chụp để nhận diện bị xóa ngay sau khi xử lý.',
  fall: 'Khi phát hiện té ngã, ảnh chụp nhanh được gửi cho người chăm sóc và lưu 12 tháng.',
  rights: 'Bạn có thể yêu cầu người chăm sóc hoặc trung tâm xóa dữ liệu bất cứ lúc nào.',
} as const;

export const Strings = {
  app: {
    name: 'VisionAid',
    tagline: 'Trợ lý dẫn đường cho người khiếm thị',
    ready: "VisionAid đã sẵn sàng. Chạm hai lần hoặc nói 'bắt đầu' để dẫn đường.",
    loading: 'Đang tải',
  },
  auth: {
    loginTitle: 'Đăng nhập',
    emailLabel: 'Email',
    passwordLabel: 'Mật khẩu',
    loginButton: 'Đăng nhập',
    loginHint: 'Chạm hai lần để đăng nhập',
    emailHint: 'Nhập email đăng nhập',
    passwordHint: 'Nhập mật khẩu',
    loggingIn: 'Đang đăng nhập',
    loginSuccess: 'Đăng nhập thành công',
    invalidEmail: 'Email không hợp lệ',
    passwordRequired: 'Vui lòng nhập mật khẩu',
    wrongCredentials: 'Email hoặc mật khẩu không đúng',
    accountLocked: 'Tài khoản đã bị khóa. Vui lòng liên hệ người chăm sóc.',
    tooManyAttempts: 'Bạn thử quá nhiều lần, vui lòng đợi một phút',
    wrongRole:
      'Tài khoản này không dùng được trên ứng dụng di động. Vui lòng dùng trang web quản lý.',
    sessionExpired: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    logoutButton: 'Đăng xuất',
    logoutHint: 'Chạm hai lần để đăng xuất khỏi ứng dụng',
    loggedOut: 'Đã đăng xuất',
    showPassword: 'Hiện mật khẩu',
    hidePassword: 'Ẩn mật khẩu',
    togglePasswordHint: 'Chạm hai lần để đổi chế độ hiện mật khẩu',
  },
  privacy: {
    title: 'Chính sách bảo mật',
    intro: privacyIntro,
    points: privacyPoints,
    content: [privacyIntro, ...Object.values(privacyPoints)].join(' '),
    readAgainButton: 'Nghe lại chính sách',
    readAgainHint: 'Chạm hai lần để nghe lại nội dung chính sách',
    acceptButton: 'Tôi đồng ý',
    acceptHint: 'Chạm hai lần để đồng ý chính sách bảo mật và tiếp tục',
    accepted: 'Đã ghi nhận sự đồng ý của bạn',
  },
  common: {
    back: 'Quay lại',
    backHint: 'Chạm hai lần để quay lại màn hình trước',
  },
  network: {
    online: 'Đang có kết nối mạng',
    offline: 'Không có mạng. Dẫn đường vẫn hoạt động; đọc chữ và nhận diện người quen tạm dừng.',
  },
  settings: {
    account: 'Tài khoản',
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
    greeting: (name: string) => (name ? `Xin chào, ${name}` : 'Xin chào'),
    startNavigation: 'Bắt đầu dẫn đường',
    startNavigationHint: 'Chạm hai lần để bắt đầu phát hiện vật cản',
    settingsHint: 'Chạm hai lần để mở cài đặt và đăng xuất',
  },
  errors: {
    forbidden: 'Bạn không có quyền thực hiện thao tác này',
    unavailable: 'Tính năng tạm thời không khả dụng',
    offline: 'Không có kết nối mạng. Vui lòng kiểm tra mạng và thử lại.',
    ocrNeedsNetwork: 'Tính năng đọc chữ cần kết nối mạng',
    faceNeedsNetwork: 'Tính năng nhận diện người quen cần kết nối mạng',
  },
  distance: {
    Near: 'ở gần',
    Medium: 'phía trước',
    Far: 'ở xa',
  },
} as const;
