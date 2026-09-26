# CLAUDE.md — VisionAid Mobile App (React Native) Master Context

> **Mục đích:** File này là nguồn sự thật duy nhất (single source of truth) cho toàn bộ quá trình code **Mobile App** của dự án VisionAid — ứng dụng dành cho **Người khiếm thị (Visually Impaired User — VIU)**. Claude phải đọc và tuân thủ toàn bộ nội dung này trước khi generate bất kỳ code nào.
>
> Nguồn gốc: `VisionAid.docx` (Capstone Document — SRS, Business Rules, Use Cases), `CapstoneDescription.txt`, `DB.txt` (Database v8.0), và CLAUDE.md của Backend (ASP.NET Core 9).

---

## 0. QUY TẮC BẮT BUỘC CHO CLAUDE

> **KHÔNG BAO GIỜ tự động chạy các lệnh git mà không có sự đồng ý rõ ràng của user.**

- KHÔNG tự chạy `git add`, `git commit`, `git push`, `git reset`, `git checkout` hay bất kỳ lệnh git nào khác
- Sau khi hoàn thành code, CHỈ thông báo cho user biết những file đã thay đổi và đề xuất nội dung commit message (semantic: `feat:`, `fix:`, `build:`...)
- Chờ user nói "commit đi" hoặc xác nhận rõ ràng trước khi chạy bất kỳ lệnh git nào
- Tương tự, KHÔNG tự động push code hay tạo pull request
- KHÔNG tự chạy `eas build`, `eas submit` hay lệnh publish/OTA update (`eas update`) khi chưa được user xác nhận

---

## 1. PROJECT OVERVIEW

**Tên dự án:** VisionAid — AI-Powered Navigation and Scene Understanding Assistant for Visually Impaired
**Mã dự án:** FA26SE013 — Group GFA26SE15
**Bản chất hệ thống:** Mobile App (Offline-first AI) + Web Dashboard (Caregiver / Center Admin / Super Admin) + Backend ASP.NET Core 9 (Modular Monolith).

### Phạm vi của repo này
| Thành phần | Thuộc repo này? | Ghi chú |
|---|---|---|
| **Mobile App cho VIU** | ✅ | React Native + Expo, **Android 10+** là nền tảng chính |
| Caregiver / Center Admin / Super Admin Dashboard | ❌ | Web React — repo riêng |
| Backend API, Background Jobs, SignalR Hub | ❌ | ASP.NET Core 9 — repo riêng. App mobile chỉ là **client** |
| VietOCR, FaceNet inference | ❌ | Container phía server — mobile gửi ảnh qua Backend API |

> **Mobile App CHỈ dành cho role `VisuallyImpaired`.** Nếu user đăng nhập với role khác → từ chối, TTS: "Tài khoản này không dùng được trên ứng dụng di động. Vui lòng dùng trang web quản lý." (Screen Authorization trong SRS: mọi màn hình mobile chỉ VIU truy cập.)
> iOS nằm ngoài phạm vi chính (EX-07) — code không được chủ động phá vỡ iOS, nhưng chỉ test/đảm bảo trên Android.

### Nguyên tắc sản phẩm cốt lõi
1. **Audio-first:** Người dùng KHÔNG cần nhìn màn hình. Mọi thao tác đều có phản hồi TTS tiếng Việt + haptic.
2. **Offline-first:** Obstacle Detection (YOLOv8n) và Voice Commands (Whisper fallback) chạy hoàn toàn offline.
3. **Graceful degradation:** Mất mạng → TTS báo tính năng server (OCR, Face) tạm không khả dụng; KHÔNG crash, KHÔNG treo.
4. **An toàn trước hết:** Fall detection, SOS, xác nhận lệnh nguy hiểm phải luôn tin cậy.

---

## 2. TECH STACK

### Core
| Thành phần | Lựa chọn | Ghi chú |
|---|---|---|
| Framework | **React Native + Expo SDK (mới nhất ổn định)** | Dùng **Development Build** (`expo prebuild` / EAS Build) — KHÔNG dùng Expo Go vì cần native modules |
| Language | **TypeScript (strict mode)** | Không dùng `any` |
| Routing | **Expo Router** | File-based routing |
| Server state | **TanStack Query** | Cache, retry, offline pause |
| Client state | **Zustand** | Auth, settings, navigation session, TTS queue state |
| HTTP | **Axios** | Interceptor gắn JWT + refresh token rotation |
| Validation | **Zod** | Validate response API + form login |
| Testing | **Jest + React Native Testing Library** | ≥ 70% coverage cho logic layer (services, stores, utils) |
| Lint/Format | ESLint + Prettier | |

### Native / Device
| Chức năng | Package | Ghi chú |
|---|---|---|
| Camera + frame processing | `react-native-vision-camera` (+ `react-native-worklets-core`) | Frame processor cho YOLO real-time |
| On-device AI (YOLOv8n INT8) | `onnxruntime-react-native` | Theo tài liệu dự án. **Fallback** nếu tích hợp frame processor thất bại: `react-native-fast-tflite` (export YOLOv8n → TFLite INT8), hoặc cuối cùng là server-side detection (Risk #2) |
| QR scan | `react-native-vision-camera` code scanner | On-device, không cần mạng để đọc nội dung QR |
| TTS | `expo-speech` | Giọng tiếng Việt `vi-VN`; bọc trong `TtsService` có priority queue |
| STT Online | `expo-speech-recognition` (hoặc `@react-native-voice/voice`) | Dùng Google Speech qua Android SpeechRecognizer (không nhúng API key trong app). `@react-native-voice/voice` ít được bảo trì — ưu tiên `expo-speech-recognition` nếu tương thích |
| STT Offline | `whisper.rn` | Whisper on-device (ggml), fallback khi offline hoặc Google STT lỗi. Docx ghi "small model" (~470MB) — quá nặng cho máy 4GB RAM và vượt giới hạn kích thước AAB → benchmark `tiny`/`base` trước; model **tải về lần đầu chạy** (khi có Wi-Fi), KHÔNG bundle vào APK |
| Accelerometer | `expo-sensors` | Fall detection |
| GPS | `expo-location` + `expo-task-manager` | Background location, low-power mode |
| Battery | `expo-battery` | Auto Minimal Mode < 10% |
| Haptics | `expo-haptics` | Kết hợp với mọi alert quan trọng |
| Network | `@react-native-community/netinfo` | Detect online/offline |
| Real-time | `@microsoft/signalr` | Hub `/hubs/location` |
| Push | `@react-native-firebase/app` + `@react-native-firebase/messaging` | FCM token + nhận notification |
| Secure storage | `expo-secure-store` | Access/refresh token, `client_device_id` |
| Local DB | `expo-sqlite` | Offline queue (GPS, logs), location cache, emergency contacts cache |
| Gọi điện trực tiếp | Native module dùng Intent `ACTION_CALL` (ví dụ `react-native-immediate-phone-call`) + quyền `CALL_PHONE` | SOS **tự quay số** — `tel:` qua `Linking` chỉ mở trình quay số, người khiếm thị vẫn phải tự tìm nút gọi → KHÔNG dùng `tel:` cho SOS |
| Zalo | `expo-linking` (Zalo deep link) | Khi contact_type = ZALO / BOTH |
| Keep awake | `expo-keep-awake` | Trong navigation session |

---

## 3. PROJECT STRUCTURE

```
visionaid-mobile/
├── app/                                  # Expo Router — chỉ chứa screen, logic ở src/features
│   ├── _layout.tsx                       # Providers: QueryClient, TTS, SignalR, Network, Auth guard
│   ├── (auth)/
│   │   ├── login.tsx                     # Login Screen
│   │   └── privacy-consent.tsx           # Privacy Consent Screen (bắt buộc trước khi dùng app)
│   └── (main)/
│       ├── _layout.tsx                   # Global overlays: Voice Bottom Sheet, SOS overlay, System Alerts
│       ├── index.tsx                     # Home Screen — camera feed + radar + obstacle detection
│       ├── ocr.tsx                       # OCR & QR Scanner UI
│       ├── face.tsx                      # Face Recognition UI
│       ├── location.tsx                  # Location Query UI ("Tôi đang ở đâu?")
│       ├── emergency.tsx                 # Emergency SOS UI (confirm, fall countdown, sent confirmation)
│       └── settings.tsx                  # Profile & Settings (TTS, detection mode, profile, logout)
│
├── src/
│   ├── api/
│   │   ├── client.ts                     # Axios instance + interceptors (JWT, refresh rotation, ProblemDetails)
│   │   ├── types.ts                      # ApiResponse<T>, ProblemDetails, PagedResult<T>
│   │   └── endpoints/                    # 1 file / resource: auth.ts, users.ts, ocr.ts, face.ts,
│   │                                     #   navigation.ts, locations.ts, emergency.ts, voice.ts,
│   │                                     #   fcm.ts, systemConfigs.ts
│   │
│   ├── features/                         # Logic theo domain (hooks + components riêng của feature)
│   │   ├── auth/
│   │   ├── obstacle-detection/           # YOLO pipeline, distance estimator, priority selector
│   │   ├── ocr/
│   │   ├── face-recognition/
│   │   ├── voice-commands/               # Intent matcher, confirmation flow
│   │   ├── location/                     # GPS tracking, arrival notification, "where am I"
│   │   ├── emergency/                    # Fall detector, SOS flow, grace period countdown
│   │   └── settings/
│   │
│   ├── services/                         # Singleton services, không phụ thuộc UI
│   │   ├── tts/TtsService.ts             # Priority queue + per-class cooldown
│   │   ├── ai/YoloDetector.ts            # Load model, preprocess, inference, NMS
│   │   ├── speech/SpeechService.ts       # Google STT → Whisper fallback
│   │   ├── signalr/LocationHubClient.ts
│   │   ├── fcm/FcmService.ts
│   │   ├── sensors/FallDetector.ts
│   │   ├── battery/BatteryMonitor.ts
│   │   ├── network/NetworkMonitor.ts
│   │   ├── haptics/HapticService.ts
│   │   └── storage/
│   │       ├── secureStorage.ts          # Tokens, client_device_id
│   │       ├── db.ts                     # SQLite init + migrations
│   │       └── offlineQueue.ts           # Queue GPS / logs khi offline, flush khi online
│   │
│   ├── stores/                           # Zustand: authStore, settingsStore, sessionStore, networkStore
│   ├── constants/
│   │   ├── businessRules.ts              # Hằng số nghiệp vụ (mục 10)
│   │   ├── enums.ts                      # Enum khớp DB v8.0 (mục 7)
│   │   ├── voiceCommands.ts              # Danh sách lệnh + từ khóa (mục 12)
│   │   ├── obstacleClasses.ts            # Class YOLO → tên tiếng Việt, cờ nguy hiểm
│   │   └── strings.vi.ts                 # TẤT CẢ câu TTS / label tiếng Việt
│   ├── components/                       # Accessible primitives: A11yButton, A11yText, BigActionButton...
│   ├── hooks/
│   └── utils/
│
├── assets/
│   └── models/
│       └── yolov8n_int8.onnx             # (hoặc .tflite nếu dùng fallback) — Whisper model tải runtime, không để ở đây
│
├── __tests__/ (hoặc *.test.ts cạnh file)
├── app.config.ts                         # Permissions, plugins, Android config
├── eas.json
├── .env.example
└── CLAUDE.md
```

**Quy ước:** Screen trong `app/` phải mỏng — chỉ gọi hooks từ `src/features/*`. Services không import React.

---

## 4. MÀN HÌNH & TÍNH NĂNG (từ SRS 3.1.2.1)

| # | Tính năng | Screen | FE / UC |
|---|---|---|---|
| 1 | Đăng nhập | Login Screen | FE-01, UC-1 |
| 2 | Đồng ý chính sách bảo mật | Privacy Consent Screen | UC-20 |
| 3 | Màn hình chính (camera + radar) | Home Screen | FE-03, UC-21/22/23 |
| 4 | Cảnh báo pin yếu | System Alerts UI (overlay) | FE-14, BR-17 |
| 5 | Thông báo đến địa điểm quen | System Alerts UI (overlay) | FE-13, BR-32 |
| 6 | Cài đặt TTS (giọng, tốc độ, âm lượng, ngôn ngữ phụ) | Profile & Settings | FE-02, UC-7/10/11/12 |
| 7 | Chuyển Minimal / Full mode | Profile & Settings | FE-11, UC-9 |
| 8 | Ra lệnh giọng nói | Voice Listening Bottom Sheet | FE-09, UC-19 |
| 9 | Nhận diện người quen | Face Recognition UI | FE-08, UC-24 |
| 10 | Đọc chữ / QR | OCR & QR Scanner UI | FE-06/07, UC-13/14 |
| 11 | Hỏi vị trí hiện tại | Location Query UI | FE-12, UC-15 |
| 12 | Xác nhận gọi khẩn cấp | Emergency SOS UI | FE-10, UC-16/17/18 |
| 13 | Đếm ngược té ngã (15s) + haptic | Emergency SOS UI | FE-28, UC-8 |
| 14 | Xác nhận đã gửi cảnh báo | Emergency SOS UI | BR-27 |

Ngoài màn hình: xem profile, đổi mật khẩu, logout (UC-3..6).

### App flow
```
Launch
 ├─ Chưa có token        → Login
 ├─ Role ≠ VisuallyImpaired → từ chối + logout
 ├─ privacy_consent_accepted_at == null → Privacy Consent (bắt buộc)
 └─ OK → Home
         ├─ Load: /users/me, TTS preferences, public system configs, emergency contacts (cache SQLite)
         ├─ Register FCM token (kèm client_device_id)
         ├─ Connect SignalR (/hubs/location)
         ├─ Start: BatteryMonitor, NetworkMonitor (FallDetector chỉ chạy trong navigation session — xem 9.7)
         └─ TTS: "VisionAid đã sẵn sàng. Chạm hai lần hoặc nói 'bắt đầu' để dẫn đường."
```

---

## 5. ACCESSIBILITY & AUDIO-FIRST UX — BẮT BUỘC

1. **Mọi** phần tử tương tác phải có `accessibilityLabel`, `accessibilityHint`, `accessibilityRole` (SRS 4.1.1). Không có ngoại lệ.
2. Vùng chạm lớn: tối thiểu **48×48dp**; các action chính dùng nút chiếm diện tích lớn (nửa/toàn màn hình).
3. UI high-contrast, tối giản; font lớn; không truyền đạt thông tin chỉ bằng màu sắc.
4. **Mọi hành động phải có TTS xác nhận** (bắt đầu/kết thúc session, đổi mode, lưu setting, gửi SOS, lỗi...).
5. Alert quan trọng = **TTS + Haptic** (fall countdown: rung theo nhịp mỗi giây; SOS sent: pattern rung riêng).
6. Mọi tính năng cốt lõi truy cập được bằng **giọng nói hoặc 1 cử chỉ chạm đơn giản** — không yêu cầu nhìn màn hình.
7. Tương thích **TalkBack**: khi TalkBack bật, tránh đọc đè — dùng `AccessibilityInfo.isScreenReaderEnabled()` để điều chỉnh (ví dụ ưu tiên `announceForAccessibility` cho thông báo UI, giữ `TtsService` cho cảnh báo vật cản/khẩn cấp).
8. Voice command không nhận diện được hoặc confidence thấp → TTS yêu cầu nói lại, **KHÔNG** thực thi đoán mò.
9. Mất quyền camera giữa session → không crash, TTS hướng dẫn cấp lại quyền (SRS 4.2.2).
10. Mất GPS → dùng vị trí cuối cùng đã biết, không treo.
11. Tất cả chuỗi tiếng Việt nằm trong `src/constants/strings.vi.ts` — không hard-code trong component.

---

## 6. BACKEND API CONTRACT (client-side view)

### Base
```
Base URL:   EXPO_PUBLIC_API_BASE_URL   (ví dụ https://api.visionaid.vn)
SignalR:    EXPO_PUBLIC_SIGNALR_URL    (ví dụ https://api.visionaid.vn/hubs/location)
Pattern:    /api/{resource} — không versioning
Transport:  HTTPS bắt buộc (HTTP chỉ cho dev local)
```

### Response thành công — `ApiResponse<T>`
```ts
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: string[];
}

interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
```

### Response lỗi — RFC 7807 Problem Details
```ts
interface ProblemDetails {
  type: string;
  title: string;        // "Validation Error" | "Not Found" | "Forbidden" | "Conflict" | "Business Rule Violation"
  status: number;       // 400 | 401 | 403 | 404 | 409 | 422 | 500
  detail: string;
  errors?: Record<string, string[]>;  // chỉ có với 400
}
```
Axios interceptor chuẩn hóa mọi lỗi thành `AppError { status, title, detail, fieldErrors? }`. UI/TTS KHÔNG đọc nguyên văn `detail` tiếng Anh cho người dùng — map sang câu tiếng Việt thân thiện trong `strings.vi.ts`.

| Status | Xử lý phía mobile |
|---|---|
| 401 | Thử refresh token 1 lần → thất bại thì logout + TTS "Phiên đăng nhập đã hết hạn" |
| 403 | TTS "Bạn không có quyền thực hiện thao tác này" |
| 409 / 422 | Đọc thông điệp nghiệp vụ đã map |
| 5xx / timeout / offline | TTS "Tính năng tạm thời không khả dụng", đưa vào offline queue nếu là log |

### Endpoints mobile sử dụng
> ⚠️ Tên endpoint theo convention của Backend CLAUDE.md. Những endpoint đánh dấu **(TBC)** cần xác nhận lại với team Backend trước khi code.

| Method | Endpoint | Mục đích |
|---|---|---|
| POST | `/api/auth/login` | `{ email, password, clientDeviceId, deviceInfo }` → access + refresh token |
| POST | `/api/auth/refresh` | `{ refreshToken, clientDeviceId }` → cặp token mới |
| POST | `/api/auth/logout` | `{ clientDeviceId }` → revoke token + deactivate FCM của device |
| POST | `/api/auth/accept-privacy-policy` | `{ policyVersion }` (TBC) |
| GET / PUT | `/api/users/me` | Xem / cập nhật profile |
| PUT | `/api/users/me/password` | Đổi mật khẩu (TBC) |
| GET / PUT | `/api/users/me/tts-preferences` | TTS preferences (TBC) |
| GET | `/api/users/me/emergency-contacts` | Danh sách liên hệ khẩn cấp, sort `priority_order ASC` — VIU chỉ đọc (TBC) |
| GET | `/api/system-configs/public` | Config `is_public = TRUE` (thresholds, cooldown...) (TBC) |
| POST | `/api/fcm-tokens` | `{ fcmToken, deviceType: "ANDROID", deviceModel, appVersion, clientDeviceId }` (TBC) |
| POST | `/api/navigation/sessions` | Start session → trả `sessionId` |
| PATCH | `/api/navigation/sessions/{id}/end` | End session + tổng `totalDetections`, `totalAlertsIssued` |
| POST | `/api/navigation/sessions/{id}/events` | Batch detection events (TBC) |
| POST | `/api/ocr` | multipart: ảnh + `triggerMethod`, `location` → text đã xử lý + confidence |
| POST | `/api/ocr/qr` | `{ qrContent, qrType, triggerMethod, location }` — QR decode on-device (TBC) |
| POST | `/api/face-registry/recognize` | multipart: ảnh → `{ result, personDisplayName?, similarityScore }` (TBC) |
| POST | `/api/voice-commands` | Batch voice command logs (TBC) |
| POST | `/api/locations/batch` | Flush GPS offline queue (dedupe bằng `clientGeneratedId`) (TBC) |
| GET | `/api/locations/reverse-geocode?lat=&lng=` | Địa chỉ (Backend gọi Mapbox + Redis cache, cập nhật `location_cache`) (TBC) |
| POST | `/api/emergency-events` | JSON: `detectionMethod`, `detectedAt` (giờ thiết bị), `accelerometerData?`, `location` — request nhỏ, gửi ngay |
| POST | `/api/emergency-events/{id}/snapshot` | multipart ảnh snapshot, upload **sau** khi event đã tạo (TBC) |
| POST | `/api/emergency-events/{id}/dismiss` | User hủy trong grace period |
| POST | `/api/emergency-events/{id}/called` | Đánh dấu user đã gọi emergency contact (TBC) |

### Enum serialization
Giá trị enum trong JSON dùng đúng **giá trị DB (SCREAMING_SNAKE_CASE)** — ví dụ `"ACCELEROMETER_CAMERA"`, `"NEAR"`. Riêng claim `role` trong JWT dùng PascalCase: `"VisuallyImpaired"`. **(TBC với Backend — `JsonStringEnumConverter` config.)**

### Location format
Gửi lên API dạng `{ latitude: number, longitude: number }` (WGS84 / SRID 4326). Backend tự convert sang `geography(Point,4326)`. KHÔNG gửi WKT string.

---

## 7. ENUMS (khớp DB v8.0)

```ts
// src/constants/enums.ts
export type UserRole = 'Admin' | 'CenterAdmin' | 'Caregiver' | 'VisuallyImpaired'; // JWT claim
export type DbUserRole = 'ADMIN' | 'CENTER_ADMIN' | 'CAREGIVER' | 'VISUALLY_IMPAIRED'; // có thể xuất hiện trong response API (TBC)
// → Luôn so sánh role qua helper isVisuallyImpaired(role) chấp nhận cả 2 dạng, không so sánh chuỗi trực tiếp
export type TtsVoiceGender = 'MALE' | 'FEMALE';
export type DetectionMode = 'MINIMAL' | 'FULL';
export type DistanceRange = 'NEAR' | 'MEDIUM' | 'FAR';
export type RecognitionResult = 'MATCHED' | 'NOT_MATCHED' | 'LOW_CONFIDENCE' | 'ERROR';
export type OcrRequestType = 'TEXT_READING' | 'QR_CODE';
export type TriggerMethod = 'VOICE_COMMAND' | 'TAP';
export type OcrResultStatus = 'SUCCESS' | 'LOW_CONFIDENCE' | 'FAILED' | 'RETRIED';
export type DetectionMethod = 'ACCELEROMETER_CAMERA' | 'MANUAL' | 'VOICE_COMMAND' | 'GESTURE';
export type AlertStatus =
  | 'DETECTED' | 'DISMISSED' | 'SENT' | 'ACKNOWLEDGED' | 'ESCALATED' | 'RESOLVED' | 'CALLED';
export type CommandStatus = 'SUCCESS' | 'FAILED' | 'UNRECOGNIZED' | 'CONFIRMED' | 'CANCELLED';
export type RecognitionEngine = 'GOOGLE_SPEECH' | 'WHISPER';
export type NetworkStatus = 'WIFI' | 'MOBILE_4G' | 'MOBILE_3G' | 'OFFLINE';
export type DeviceType = 'ANDROID' | 'IOS' | 'WEB';
export type EmergencyContactType = 'PHONE' | 'ZALO' | 'BOTH';
export type NotificationType =
  | 'FALL_DETECTED' | 'EMERGENCY_MANUAL' | 'GEOFENCE_BREACH' | 'ARRIVAL_NOTIFICATION' | 'SYSTEM_ALERT';
```

---

## 8. AUTHENTICATION (client-side)

### Token storage
- `accessToken` (15 phút), `refreshToken` (30 ngày), `clientDeviceId` → **`expo-secure-store`**. KHÔNG lưu token trong AsyncStorage/SQLite/Zustand persist.
- `clientDeviceId`: UUID v4 sinh **một lần** khi cài app, lưu SecureStore, dùng cho cả refresh token và FCM token (backend match 2 bảng qua cột này khi logout).

### JWT claims (decode phía client chỉ để đọc, không để bảo mật)
```
nameidentifier → userId | email | role → "VisuallyImpaired" | organization_id → UUID hoặc rỗng
```
> ⚠️ ASP.NET dùng `ClaimTypes.*` nên trong JWT payload key có thể là URI dài, ví dụ
> `http://schemas.microsoft.com/ws/2008/06/identity/claims/role`,
> `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier`.
> Ưu tiên lấy `userId`/`role` từ **response body của `/auth/login` hoặc `/users/me`** thay vì decode JWT. Nếu buộc phải decode, đọc cả key ngắn lẫn key URI.

### Refresh rotation — Axios interceptor
```
1. Request 401 → nếu chưa refresh trong request này:
2. Single-flight: chỉ 1 request /auth/refresh chạy tại 1 thời điểm; các request khác chờ promise đó
3. Thành công → lưu CẢ access + refresh MỚI (refresh cũ đã bị revoke ở server) → retry request gốc
4. Thất bại (401/403 — ví dụ token reuse bị phát hiện, account bị deactivate)
   → xóa toàn bộ token, disconnect SignalR, dừng GPS tracking → về Login + TTS thông báo
```
> ⚠️ **KHÔNG bao giờ gửi lại refresh token cũ** sau khi đã rotate — server coi là reuse attack và revoke TẤT CẢ phiên của user (BR-34). Race condition giữa nhiều request đồng thời là nguyên nhân phổ biến nhất → bắt buộc single-flight.

### Logout
```
POST /api/auth/logout { clientDeviceId } → (bỏ qua lỗi mạng)
→ Xóa SecureStore tokens (GIỮ clientDeviceId), clear TanStack Query cache, xóa SQLite user data
→ Stop GPS background task, disconnect SignalR, end navigation session nếu đang chạy
```

### Account bị deactivate (BR-36)
Server revoke mọi token + terminate GPS sessions → client nhận 401 ở lần refresh kế tiếp → xử lý như bước 4 ở trên.

---

## 9. CORE FEATURES — ĐẶC TẢ TRIỂN KHAI

### 9.1 Obstacle Detection (YOLOv8n — OFFLINE)
```
Camera (vision-camera) → frame processor (frame skipping) → resize/normalize
→ YOLOv8n INT8 inference (ONNX Runtime) → NMS → lọc confidence >= yolo_confidence_threshold
→ ước lượng distance range → chọn object ưu tiên → TtsService.enqueue(priority)
```
- **Performance:** ≤ 500ms/cycle trên Android mid-range (Galaxy A-series, 4GB RAM); TTS từ lúc detect → phát âm ≤ 1s.
- **Frame skipping:** không inference mọi frame (ví dụ 2–4 fps inference), tùy chỉnh để giữ pin ≤ 20%/giờ.
- **Distance (BR-11, LI-01):** chỉ categorical `NEAR / MEDIUM / FAR`, ước lượng từ tỉ lệ bounding box so với frame (ngưỡng đặt trong `businessRules.ts`, tinh chỉnh khi benchmark). **KHÔNG BAO GIỜ đọc số mét/khoảng cách tuyệt đối.**
- **Priority (BR-12):** mỗi cycle chỉ announce object **gần nhất + nguy hiểm nhất** (sort: danger flag → distance NEAR>MEDIUM>FAR → confidence).
- **Cooldown (BR-13):** mỗi `object_class` tối thiểu **3s** (`tts_cooldown_seconds` từ system config) giữa 2 lần announce.
- **Minimal Mode:** chỉ announce class có cờ `dangerous` trong `obstacleClasses.ts` (xe máy, ô tô, xe buýt, xe tải, xe đạp, bậc thang/hố... — danh sách chốt theo class model hỗ trợ). **Full Mode:** announce tất cả.
- **Câu TTS:** `"{Tên vật tiếng Việt} {ở gần | phía trước | ở xa}"` — ngắn gọn.
- **Logging:** ghi `obstacle_detection_events` (object_class, confidence, distance_range, bounding_box normalized 0–1, alert_issued, inference_time_ms, detected_at, location) vào SQLite → flush batch lên server định kỳ / khi online. Không gửi từng event realtime.
- **Session:** Start → `POST /navigation/sessions` (nếu offline: tạo session local, sync sau) + bắt đầu GPS sharing (UC-22 included) + bật FallDetector. End → gửi tổng kết, tắt FallDetector.

### 9.2 TTS Service — Priority Queue (FE-35)
```ts
enum TtsPriority { EMERGENCY = 0, DANGER = 1, SYSTEM = 2, FEEDBACK = 3, INFO = 4 }
```
- Priority cao hơn **interrupt** (stop) utterance đang đọc có priority thấp hơn.
- `EMERGENCY` (fall countdown, SOS) luôn được phát, bỏ qua cooldown và mode.
- Dedupe: không enqueue lặp cùng nội dung đang chờ.
- Áp dụng `speed_rate` (0.5–2.0), `volume_level` (0.0–1.0), `voice_gender`, `primary_language` từ preferences.
- Không để queue phình: object announce cũ hơn 1 cycle bị drop.

### 9.3 OCR & QR (ONLINE cho OCR, QR decode offline)
- **OCR:** chụp ảnh → nén (giới hạn kích thước, JPEG) → `POST /api/ocr` → server tiền xử lý (xoay, cân sáng, khử nhiễu) + VietOCR.
  - `confidence < threshold` hoặc `LOW_CONFIDENCE` → **KHÔNG đọc** kết quả, TTS: "Không đọc rõ, vui lòng chụp lại ở nơi đủ sáng" (BR-24).
  - Target ≤ 3s (P95). Hiện TTS "Đang đọc..." nếu > 1.5s.
- **QR:** decode on-device bằng code scanner → đọc nội dung qua TTS; nếu là URL → đọc domain + hỏi có mở không (xác nhận bằng giọng nói); log qua `POST /api/ocr/qr` (queue nếu offline).
- VIU **không xem lại lịch sử OCR** trên app — lịch sử chỉ dành cho Caregiver trên web (BR-25).
- Offline → TTS: "Tính năng đọc chữ cần kết nối mạng" (vẫn cho phép quét QR).

### 9.4 Face Recognition (ONLINE)
- Chụp ảnh → `POST /api/face-registry/recognize` → server FaceNet + pgvector cosine similarity.
- Chỉ announce khi `MATCHED` (similarity **>** threshold, mặc định 0.75 — BR-21): TTS "{display_name} ({relationship}) ở phía trước".
- `NOT_MATCHED` → "Không nhận ra người này". `LOW_CONFIDENCE` → "Chưa rõ, vui lòng hướng camera thẳng vào khuôn mặt".
- **Privacy (BR-22):** ảnh tạm dùng để nhận diện **xóa khỏi thiết bị ngay** sau khi request xong (kể cả lỗi) — dùng `finally`. KHÔNG lưu vào gallery, KHÔNG cache, KHÔNG log.
- VIU **không quản lý** face registry — việc đó do Caregiver làm trên web.
- Offline → TTS: "Tính năng nhận diện người quen cần kết nối mạng".

### 9.5 Voice Commands (FE-09)
```
Kích hoạt (nút lớn / cử chỉ) → Voice Listening Bottom Sheet + haptic + tiếng "bíp"
→ Online & Google STT OK ? Google Speech : Whisper (offline)
→ transcript → intent matcher (từ khóa trong voiceCommands.ts, không phân biệt dấu/hoa thường)
→ confidence thấp / không khớp → TTS "Tôi chưa hiểu, vui lòng nói lại" (UNRECOGNIZED)
→ lệnh nguy hiểm → Confirmation flow
→ thực thi → TTS xác nhận → log voice_command_logs (queue)
```
- **Fallback (BR-16):** Google STT lỗi/offline → tự động Whisper + TTS: "Đang dùng nhận dạng giọng nói ngoại tuyến".
- **Lệnh nguy hiểm (BR-14):** "Gọi khẩn cấp" → TTS "Bạn có chắc muốn gọi khẩn cấp? Nói 'có' để xác nhận" → chờ tối đa **10s** → không xác nhận → tự hủy (`CANCELLED`) + TTS thông báo đã hủy.
- Log: `raw_transcript`, `matched_command`, `recognition_engine`, `confidence_score`, `execution_status`, `required_confirmation`, `confirmed_at`, `processing_time_ms`, `audio_duration_ms` (để tính RTF), `is_offline`, `location`.
- Target ≤ 2s end-to-end (online).

### 9.6 Location & GPS (FE-12, FE-13, FE-29)
- **Tracking:** `expo-location` background task (foreground service Android, thông báo thường trực). Mỗi điểm có `clientGeneratedId` (UUID) để server chống trùng khi retry.
  - App ở **foreground** + SignalR connected → gửi qua hub method (tên TBC, ví dụ `SendLocation`).
  - App ở **background** (task chạy headless JS, kết nối SignalR không đảm bảo sống) → ghi SQLite queue và gửi qua REST `POST /api/locations/batch`. KHÔNG phụ thuộc SignalR trong background task.
- **Phạm vi thời gian (cần chốt với team):** UC-22/23 gắn GPS sharing với navigation session (Start → bật, End → tắt). Nhưng geofence breach (FE-19, FE-29) cần GPS cả khi không navigate → đề xuất: ngoài session vẫn tracking **low-power** (tần suất thấp), trong session tracking tần suất cao.
- Payload: `latitude, longitude, accuracyMeters, altitude, speedMps, heading, batteryLevel, networkStatus, recordedAt, sessionId?`.
- **Offline:** lưu vào SQLite offline queue → khi online flush qua `POST /api/locations/batch`.
- **Low-power:** giảm tần suất khi đứng yên; tăng tần suất khi đang di chuyển trong session.
- **"Tôi đang ở đâu?" (BR-15):**
  - Online → `GET /api/locations/reverse-geocode` → TTS địa chỉ → lưu cache SQLite (`formatted_address`, `cached_at`).
  - Offline → đọc cache: "Vị trí gần nhất được ghi nhận lúc {HH:mm}, {ngày}: {địa chỉ}. Thông tin này có thể không còn chính xác."
  - Không có cache → "Chưa có thông tin vị trí đã lưu".
- **Arrival notification (BR-32):** server (BoundaryMonitor) phát hiện → SignalR event `ArrivalNotification` gửi group `viu_{userId}` → app TTS tên địa điểm + `tts_announcement` (nếu có) + haptic. Khi app ở background, SignalR có thể không nhận được → cần server gửi thêm qua FCM data message (TBC).
- Geofence breach do server xử lý và báo Caregiver — app mobile không cần xử lý.

### 9.7 Emergency — Fall Detection & SOS (FE-10, FE-28)

**Fall detection (BR-26):** CHỈ trigger khi có **CẢ HAI** tín hiệu:
1. Accelerometer: gia tốc đột ngột vượt ngưỡng (key config độ nhạy chưa có trong danh sách sample keys của DB — TBC, ví dụ `fall_detection_sensitivity`)
2. Camera temporal logic: bất động kéo dài sau va chạm

Một tín hiệu đơn lẻ **KHÔNG BAO GIỜ** trigger alert.
> Hệ quả: vì cần tín hiệu camera, FallDetector **chỉ hoạt động khi đang trong navigation session** (camera bật). Ngoài session, fall detection không khả dụng — phải ghi rõ trong User Guide / Limitations.

**Luồng ACCELEROMETER_CAMERA (BR-27, BR-28):**
```
Phát hiện té ngã
→ POST /api/emergency-events { detectionMethod: ACCELEROMETER_CAMERA, detectedAt, accelerometerData, location }
   (server set DETECTED + grace_period_ends_at = detected_at + 15s)
→ Upload snapshot song song qua /{id}/snapshot — KHÔNG để upload ảnh làm chậm việc tạo event
→ Emergency SOS UI: đếm ngược 15s bằng TTS ("Phát hiện té ngã. Nói 'Tôi ổn' hoặc chạm màn hình để hủy. 15... 14...")
   + haptic mỗi giây; lắng nghe "tôi ổn" (xem quy tắc chống tự nghe bên dưới); chạm bất kỳ đâu trên màn hình = hủy
├── User hủy trong 15s → POST /{id}/dismiss → TTS "Đã hủy cảnh báo"
└── Hết 15s → server background job tự chuyển SENT + gửi Caregiver
      → app TTS "Đã gửi cảnh báo đến người chăm sóc" (Alert confirmation)
```
- Grace period được **server làm chuẩn** (source of truth); countdown trên app chỉ là UI. Việc dismiss phải gọi API trước khi server hết grace.
- Luôn gửi `detectedAt` từ thiết bị: nếu event được sync muộn từ offline queue, server tính grace từ thời điểm té thật (đã quá 15s → dispatch ngay) thay vì chờ thêm 15s. (TBC — backend hiện default `detected_at = NOW()`.)
- ⚠️ **Chống tự nghe (echo) — CRITICAL:** câu TTS countdown chứa chính cụm "Tôi ổn", câu xác nhận SOS chứa "có". Nếu mic nghe trong lúc TTS đang phát, app sẽ **tự hủy cảnh báo té ngã / tự xác nhận SOS**. Bắt buộc: bỏ qua mọi transcript thu được trong lúc TTS đang phát (hoặc chỉ mở mic trong khoảng lặng giữa các lần đọc). Chạm màn hình là cách hủy chính, luôn hoạt động.
- **Offline khi té ngã (đề xuất — cần chốt với team):** lưu event vào queue; hết 15s mà vẫn offline và không bị hủy → tự gọi emergency contact ưu tiên 1 từ cache SQLite (ACTION_CALL, xem mục 2); khi có mạng sync event lên server.

**Luồng MANUAL / VOICE_COMMAND / GESTURE:**
```
Trigger (nút SOS / lệnh "gọi khẩn cấp" / cử chỉ) → Confirmation bắt buộc (10s timeout)
→ POST /api/emergency-events { detectionMethod, detectedAt, location } (server set SENT ngay, grace = NULL)
→ TTS "Đã gửi cảnh báo khẩn cấp" → gọi emergency contact theo priority_order (PHONE/BOTH: ACTION_CALL, ZALO: deep link)
→ POST /{id}/called nếu cuộc gọi được thực hiện
```
- Emergency contacts cache trong SQLite để dùng được khi offline.
- KHÔNG bao giờ tự set status `ACKNOWLEDGED / ESCALATED / RESOLVED` từ mobile — đó là hành động của Caregiver.

### 9.8 Battery Monitor (FE-14, BR-17)
- Pin < **10%** → tự chuyển **Minimal Mode** + TTS "Pin yếu, đã chuyển sang chế độ tiết kiệm". Chỉ thông báo 1 lần mỗi lần xuống ngưỡng (không lặp).
- Gửi `batteryLevel` kèm mỗi điểm GPS.

### 9.9 Settings & Privacy
- TTS preferences: đồng bộ server, cache local để áp dụng ngay khi khởi động (kể cả offline).
- Privacy consent: hiển thị/đọc nội dung chính sách (thu thập GPS, ảnh khuôn mặt người quen) → chấp nhận bằng nút lớn hoặc giọng nói → `accept-privacy-policy` với `privacy_policy_version` hiện tại.

---

## 10. BUSINESS RULES CONSTANTS

```ts
// src/constants/businessRules.ts
// Giá trị mặc định — nếu có key tương ứng trong /system-configs/public thì ghi đè lúc runtime.
export const BusinessRules = {
  // AI thresholds
  YOLO_DEFAULT_CONFIDENCE: 0.5,            // yolo_confidence_threshold
  FACENET_DEFAULT_SIMILARITY: 0.75,        // facenet_similarity_threshold (so sánh STRICT >)
  YOLO_MAX_INFERENCE_MS: 500,

  // TTS
  TTS_COOLDOWN_SECONDS: 3,                 // tts_cooldown_seconds — per object class
  TTS_MIN_SPEED: 0.5,
  TTS_MAX_SPEED: 2.0,
  TTS_MIN_VOLUME: 0.0,
  TTS_MAX_VOLUME: 1.0,
  TTS_MAX_LATENCY_MS: 1000,

  // Emergency
  FALL_GRACE_PERIOD_SECONDS: 15,           // fall_grace_period_seconds
  DANGEROUS_COMMAND_CONFIRM_TIMEOUT_SECONDS: 10,

  // Battery
  LOW_BATTERY_THRESHOLD_PERCENT: 10,

  // Performance targets
  VOICE_COMMAND_MAX_LATENCY_MS: 2000,
  OCR_TARGET_P95_MS: 3000,
  FACE_TARGET_P95_MS: 3000,

  // Face registry upload formats (tham chiếu — upload do web xử lý)
  ALLOWED_IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png'],

  // Auth
  PASSWORD_MIN_LENGTH: 8,
} as const;
```

---

## 11. SIGNALR CLIENT

```ts
// Hub: EXPO_PUBLIC_SIGNALR_URL (/hubs/location)
// accessTokenFactory: () => lấy access token mới nhất (đã refresh nếu cần)
// withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
// VIU tự động join group "viu_{userId}" ở server khi connect

// Server → Mobile (VIU):
"ArrivalNotification"   → { savedLocationId, name, ttsAnnouncement } (payload TBC) → TTS + haptic

// Mobile → Server:
"SendLocation" (TBC)    → GPS point (xem 9.6)
```
- Kết nối lại khi app từ background → foreground và khi mạng có lại.
- Khi disconnected: GPS vào offline queue, không mất dữ liệu.
- Các event `LocationUpdated`, `EmergencyAlert`, `EscalationSuggestion`, `GeofenceBreach` dành cho web dashboard — mobile VIU không cần subscribe.

---

## 12. VOICE COMMANDS (≥ 10 lệnh cốt lõi — phải chạy được offline)

> Danh sách đề xuất, chốt lại với team. Định nghĩa trong `src/constants/voiceCommands.ts`. Matcher chuẩn hóa lowercase + khoảng trắng, **giữ dấu tiếng Việt** — bỏ dấu gây nhầm lẫn ("có"/"cô"/"cỏ" đều thành "co"). Với câu xác nhận lệnh nguy hiểm: chỉ chấp nhận danh sách từ cố định ("có", "đồng ý", "xác nhận") và confidence ≥ ngưỡng.

| # | Lệnh (ví dụ) | Hành động | Cần xác nhận |
|---|---|---|---|
| 1 | "bắt đầu", "dẫn đường" | Start navigation session | ❌ |
| 2 | "dừng lại", "kết thúc" | End navigation session | ❌ |
| 3 | "đọc chữ", "đọc biển" | OCR | ❌ |
| 4 | "quét mã", "quét QR" | QR scan | ❌ |
| 5 | "đây là ai", "ai đây" | Face recognition | ❌ |
| 6 | "tôi đang ở đâu" | Location query | ❌ |
| 7 | "gọi khẩn cấp", "cứu tôi" | SOS | ✅ (10s) |
| 8 | "chế độ tối giản" / "chế độ đầy đủ" | Đổi detection mode | ❌ |
| 9 | "tôi ổn" | Hủy fall alert trong grace period | ❌ |
| 10 | "đọc nhanh hơn" / "đọc chậm hơn" | Điều chỉnh speed_rate (±0.25, trong 0.5–2.0) | ❌ |
| 11 | "trợ giúp" | Đọc danh sách lệnh | ❌ |
| 12 | "lặp lại" | Đọc lại thông báo gần nhất | ❌ |

---

## 13. OFFLINE STRATEGY

| Tính năng | Offline? | Hành vi khi mất mạng |
|---|---|---|
| Obstacle detection | ✅ | Chạy bình thường |
| Voice commands | ✅ | Whisper fallback + TTS thông báo |
| QR decode | ✅ | Đọc nội dung, log vào queue |
| TTS | ✅ | Bình thường (đảm bảo gói giọng `vi-VN` đã cài — kiểm tra khi khởi động, hướng dẫn cài nếu thiếu) |
| Fall detection | ✅ phát hiện | Event vào queue; fallback gọi emergency contact (xem 9.7) |
| OCR / Face Recognition | ❌ | TTS "cần kết nối mạng" |
| "Tôi đang ở đâu" | ⚠️ | Địa chỉ cache + timestamp (BR-15) |
| GPS sharing | ⚠️ | Lưu SQLite, flush khi online |

**Offline queue (SQLite):** bảng `pending_gps`, `pending_detection_events`, `pending_voice_logs`, `pending_qr_logs`, `pending_emergency_events`. Flush theo thứ tự ưu tiên: emergency → GPS → logs. Retry với exponential backoff; xóa item khi server trả 2xx hoặc 409 (đã tồn tại). Giới hạn dung lượng queue (drop log cũ nhất trước, KHÔNG BAO GIỜ drop emergency).

**Quy tắc:** mọi lời gọi network phải bọc try/catch + kiểm tra `NetworkMonitor` trước; lỗi mạng KHÔNG được làm crash hay treo UI.

---

## 14. ANDROID PERMISSIONS & CONFIG

```
CAMERA, RECORD_AUDIO
ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, ACCESS_BACKGROUND_LOCATION
FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION, FOREGROUND_SERVICE_CAMERA, FOREGROUND_SERVICE_MICROPHONE
POST_NOTIFICATIONS (Android 13+)
CALL_PHONE (SOS tự quay số)
VIBRATE, WAKE_LOCK, INTERNET, ACCESS_NETWORK_STATE
HIGH_SAMPLING_RATE_SENSORS (accelerometer tần số cao, Android 12+)
```
- Xin quyền theo ngữ cảnh, **giải thích bằng TTS trước** khi hiện dialog hệ thống.
- Background location xin riêng sau khi có foreground location (yêu cầu của Android).
- minSdk tương ứng Android 10 (API 29).

---

## 15. ENVIRONMENT CONFIG

```bash
# .env.example — chỉ biến PUBLIC (được bundle vào app, KHÔNG đặt secret ở đây)
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:5000      # Android emulator → localhost máy dev
EXPO_PUBLIC_SIGNALR_URL=http://10.0.2.2:5000/hubs/location
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_PRIVACY_POLICY_VERSION=1.0
```
- `10.0.2.2` chỉ dùng được trên **emulator**. Máy thật (cần cho camera/sensor/GPS) → dùng IP LAN của máy dev (ví dụ `http://192.168.1.x:5000`).
- Android 9+ chặn HTTP cleartext mặc định → chỉ bật `usesCleartextTraffic` cho build **development** (qua `expo-build-properties`), tắt ở staging/production.
- `google-services.json` (Firebase) — không commit nếu repo public; cấu hình qua EAS secrets.
- **KHÔNG nhúng** API key Mapbox, Google Cloud, AES key hay bất kỳ secret nào vào app. Mapbox/Google gọi qua Backend.
- Backend local chạy Docker Compose ở port `5000` (xem repo Backend).

---

## 16. CODING RULES — BẮT BUỘC

### General
1. TypeScript strict, không `any`, không `// @ts-ignore` khi chưa giải thích lý do.
2. Function components + hooks. Không class components.
3. Screen trong `app/` mỏng — logic trong `src/features/*` và `src/services/*`.
4. Không hard-code config/ngưỡng — dùng `BusinessRules` (ghi đè bởi public system configs).
5. Không hard-code chuỗi tiếng Việt trong component — dùng `strings.vi.ts`.
6. Async function đặt tên rõ động từ (`uploadOcrImage`, `fetchTtsPreferences`); luôn xử lý lỗi — không để unhandled promise rejection.
7. Mọi listener/subscription (sensors, NetInfo, SignalR, location task, camera) phải cleanup trong `useEffect` return / service `stop()`.
8. Không `console.log` dữ liệu nhạy cảm (token, tọa độ, ảnh, transcript) — dùng logger có level, tắt ở production.

### Accessibility (CRITICAL)
9. Mọi `Pressable`/`TouchableOpacity`/custom control: `accessibilityLabel` + `accessibilityHint` + `accessibilityRole`. Dùng components trong `src/components/` (đã đóng gói sẵn).
10. Mọi hành động người dùng phải có TTS phản hồi; mọi alert quan trọng có haptic.

### Performance
11. Frame processor / inference chạy ngoài JS thread (worklet/native); không làm nặng JS thread trong lúc navigation.
12. Model YOLO load **1 lần** (singleton), không reload mỗi lần mở màn hình.
13. Ảnh gửi server phải resize + nén trước khi upload.

### Security & Privacy
14. Token chỉ trong `expo-secure-store`.
15. Ảnh face recognition xóa ngay sau khi xử lý (`finally`) — BR-22.
16. Chỉ gọi API qua HTTPS ở staging/production.

### Emergency (CRITICAL)
17. `ACCELEROMETER_CAMERA` chỉ trigger khi đủ 2 tín hiệu (BR-26); luôn có 15s grace period có thể hủy bằng chạm hoặc giọng nói.
18. `MANUAL / VOICE_COMMAND / GESTURE` không có grace period nhưng **bắt buộc** confirmation 10s trước khi gửi (BR-14).
19. Emergency events trong offline queue không bao giờ bị drop.
20. Không xử lý transcript thu được trong lúc TTS đang phát (chống tự nghe — mục 9.7).

### Testing
21. Unit test bắt buộc cho: `TtsService` (priority, cooldown), distance estimator, priority selector, voice intent matcher, confirmation flow (timeout), echo guard (transcript trong lúc TTS phát bị bỏ qua), FallDetector (2-signal logic), offline queue, auth refresh single-flight. Coverage logic ≥ 70%.

---

## 17. SPRINT PLAN (Mobile)

```
Sprint 1 — Foundation
  ✦ Expo project (TypeScript, Expo Router), Development Build chạy trên Android thật
  ✦ ESLint/Prettier/Jest setup
  ✦ Accessible component primitives, strings.vi.ts, enums, businessRules
  ✦ TtsService (priority queue + cooldown) + HapticService
  ✦ NetworkMonitor, SQLite init, secureStorage

Sprint 2 — Auth + Prototype AI (Risk #2)
  ✦ Axios client + refresh rotation single-flight + ProblemDetails handling
  ✦ Login, role guard (chỉ VIU), Privacy Consent, Logout
  ✦ PROTOTYPE: YOLOv8n INT8 + ONNX Runtime + vision-camera frame processor
    → Nếu thất bại: quyết định fallback (TFLite / server-side) TRƯỚC khi hết sprint

Sprint 3 — Obstacle Detection (Home Screen)
  ✦ Detection pipeline, distance estimator, priority selector, Minimal/Full mode
  ✦ Navigation session start/end + detection event logging (offline queue)
  ✦ Benchmark latency (≤ 500ms) + pin

Sprint 4 — Voice Commands
  ✦ SpeechService: Google STT (online) → Whisper (offline) fallback
  ✦ Intent matcher + 10+ lệnh cốt lõi + confirmation flow (10s)
  ✦ Voice Listening Bottom Sheet, voice command logs

Sprint 5 — Scene Understanding (Online)
  ✦ OCR screen + upload + low-confidence retake flow
  ✦ QR scanner (on-device) + URL handling
  ✦ Face recognition + privacy cleanup

Sprint 6 — Location
  ✦ Background GPS task + SignalR LocationHubClient + offline GPS queue
  ✦ "Tôi đang ở đâu?" (online + cache offline)
  ✦ ArrivalNotification handler
  ✦ FCM token registration

Sprint 7 — Emergency
  ✦ FallDetector (accelerometer + camera immobility)
  ✦ Fall countdown UI (TTS + haptic, dismiss by tap/voice)
  ✦ SOS manual / voice / gesture + emergency contacts calling
  ✦ Battery monitor auto Minimal Mode

Sprint 8 — Settings, Hardening & Release
  ✦ Settings screen (TTS prefs, mode, profile, change password)
  ✦ TalkBack compatibility pass, permission-revoke handling
  ✦ Performance benchmark (TTS ≤ 1s, OCR ≤ 3s P95, pin ≤ 20%/h)
  ✦ UAT với 2–3 người khiếm thị (SUS ≥ 70)
  ✦ EAS production build (APK/AAB)
```

---

## 18. THAM CHIẾU NHANH — DỮ LIỆU LIÊN QUAN MOBILE (DB v8.0)

| Bảng | Mobile ghi/đọc | Ghi chú |
|---|---|---|
| `users` | Đọc/cập nhật profile của chính mình | `privacy_consent_accepted_at`, `privacy_policy_version` |
| `refresh_tokens`, `fcm_device_tokens` | Gián tiếp qua auth/fcm API | Khớp nhau bằng `client_device_id` |
| `user_tts_preferences` | Đọc/ghi | 1-1 với user |
| `emergency_contacts` | Chỉ đọc | Caregiver quản lý; sort `priority_order ASC`, tối đa 5 |
| `obstacle_detection_sessions` / `_events` | Ghi | Batch |
| `ocr_requests`, `qr_scan_results` | Ghi (qua API) | VIU không xem history |
| `face_recognition_logs` | Server tự ghi khi recognize | |
| `location_history` | Ghi | `client_generated_id` UNIQUE chống trùng |
| `location_cache` | Server cập nhật; mobile có bản cache SQLite riêng | Offline "Tôi đang ở đâu" |
| `saved_locations`, `geofences` | Không trực tiếp | Server xử lý boundary, gửi ArrivalNotification |
| `emergency_events` | Tạo + dismiss + called | State machine mục 9.7 |
| `voice_command_logs` | Ghi | RTF = processing_time_ms / audio_duration_ms |
| `system_configurations` | Đọc (`is_public = TRUE`) | Ghi đè BusinessRules |

---

*Scope: Mobile App (React Native + Expo) cho Visually Impaired User — Android 10+*
*Backend: ASP.NET Core 9 Modular Monolith (repo riêng) — DB v8.0 (27 bảng)*
*Last updated: 2026-09-25 — Pre-Sprint 1 (Mobile)*
