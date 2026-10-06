# CLAUDE.md — VisionAid Mobile App (React Native) Master Context

> **Mục đích:** File này là nguồn sự thật duy nhất (single source of truth) cho toàn bộ quá trình code **Mobile App** của dự án VisionAid — ứng dụng dành cho **Người khiếm thị (Visually Impaired User — VIU)**. Claude phải đọc và tuân thủ toàn bộ nội dung này trước khi generate bất kỳ code nào.
>
> Nguồn gốc: `VisionAid.docx` (Capstone Document — SRS, Business Rules, Use Cases), `CapstoneDescription.txt`, `DB.txt` (Database v8.0), CLAUDE.md của Backend (ASP.NET Core 9), và **`VisionAid_Update_Report.docx` (28/9/2026, sau phản biện Hội đồng/Mentor — đã chốt)**: Hybrid AI dẫn đường, License/PayOS, WebRTC, Standalone Mode, giới hạn phần cứng.
>
> **Contract API đã đối chiếu với source backend thật** (`../VisionAid-BE`, 2026-09-27). Khi CLAUDE.md và backend lệch nhau, **backend là chuẩn**: kiểm tra `docs/api/openapi.json`, `docs/specs/*.md`, hoặc đọc source/graph (`../VisionAid-BE/graphify-out/`). Các điểm **(GAP)** là thứ backend chưa có, cần team Backend bổ sung, xem mục 19.

---

## 0. QUY TẮC BẮT BUỘC CHO CLAUDE

> **KHÔNG BAO GIỜ tự động chạy các lệnh git mà không có sự đồng ý rõ ràng của user.**

- KHÔNG tự chạy `git add`, `git commit`, `git push`, `git reset`, `git checkout` hay bất kỳ lệnh git nào khác
- Sau khi hoàn thành code, CHỈ thông báo cho user biết những file đã thay đổi và đề xuất nội dung commit message (semantic: `feat:`, `fix:`, `build:`...)
- Chờ user nói "commit đi" hoặc xác nhận rõ ràng trước khi chạy bất kỳ lệnh git nào
- Tương tự, KHÔNG tự động push code hay tạo pull request
- KHÔNG tự chạy `eas build`, `eas submit` hay lệnh publish/OTA update (`eas update`) khi chưa được user xác nhận
- KHÔNG thêm dòng `Co-Authored-By: Claude ...` hay "Generated with Claude Code" vào commit message / PR description (GitHub sẽ liệt kê Claude vào Contributors)

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
| VietOCR, FaceNet inference | ❌ | Container phía server (backend `a1e4df9`). OCR **lai**: online gọi server, offline ML Kit trên máy. Face: chỉ chạy trên server (`/face-registry/identify`), không có bản offline. Xem mục 9.3, 9.4 |

> **Mobile App CHỈ dành cho role `VisuallyImpaired`.** Nếu user đăng nhập với role khác → từ chối, TTS: "Tài khoản này không dùng được trên ứng dụng di động. Vui lòng dùng trang web quản lý." (Screen Authorization trong SRS: mọi màn hình mobile chỉ VIU truy cập.)
> **Caregiver không dùng app mobile này** (quyết định 2026-10-06 khi đối chiếu Update Report 28/9): đăng ký Caregiver, dùng thử, thanh toán PayOS, nhập license code, tạo tài khoản VIU đều làm trên **web dashboard**. Câu "Caregiver tải app" trong Update Report hiểu là "dùng web".
> iOS nằm ngoài phạm vi chính (EX-07) — code không được chủ động phá vỡ iOS, nhưng chỉ test/đảm bảo trên Android.

### Nguyên tắc sản phẩm cốt lõi
1. **Audio-first:** Người dùng KHÔNG cần nhìn màn hình. Mọi thao tác đều có phản hồi TTS tiếng Việt + haptic.
2. **Offline-first, Hybrid khi có mạng:** Obstacle Detection (YOLOv8n) chạy trên máy; vật **NEAR luôn cảnh báo ngay trên máy**, không chờ server. Có mạng thì vật MEDIUM/FAR được gửi lên Decision Engine để nhận hướng dẫn rẽ/tránh (Hybrid AI, mục 9.1); mất mạng/chậm → luật Rule-Based trên máy. Voice Commands offline bằng nhận dạng trên máy của Google (Android 13+, ADR 0002), máy khác dùng nút chạm.
3. **Graceful degradation:** Mất mạng → TTS báo tính năng server (OCR, Face) tạm không khả dụng; KHÔNG crash, KHÔNG treo.
4. **An toàn trước hết:** Fall detection, SOS, xác nhận lệnh nguy hiểm phải luôn tin cậy. **SOS không bao giờ bị chặn bởi license.**
5. **Không thay thế gậy trắng:** VisionAid dùng kèm gậy trắng/gậy IoT, điện thoại đeo bằng túi đeo ngực (chest strap) — xem mục 20 (Limitations).

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
| Camera + frame processing | `react-native-vision-camera` **4.7.x** (+ `react-native-worklets-core`, `vision-camera-resize-plugin`) | Frame processor cho YOLO real-time. **Giữ v4**: bản tích hợp fast-tflite cho VisionCamera v5 chưa công khai (ADR 0001) |
| On-device AI (YOLOv8n) | **`react-native-fast-tflite` 3.x** (TFLite, `runSync` trong frame processor; delegate CPU/GPU/NNAPI) | **ADR 0001** (`docs/adr/0001-on-device-inference.md`): không dùng `onnxruntime-react-native` vì không chạy được trong frame processor (chỉ có API bất đồng bộ trên JS thread). Model: input 320×320 RGB float32, output `[1, 84, 2100]` |
| QR scan | `react-native-vision-camera` code scanner | On-device, không cần mạng để đọc nội dung QR |
| TTS | `expo-speech` | Giọng tiếng Việt `vi-VN`; bọc trong `TtsService` có priority queue |
| STT Online | **`expo-speech-recognition` 57.x** (ADR 0002) | Google Speech qua Android `SpeechRecognizer` (không nhúng API key), `lang: "vi-VN"`, `EXTRA_LANGUAGE_MODEL: "web_search"` cho câu lệnh ngắn |
| STT Offline | **Cùng thư viện, `requiresOnDeviceRecognition: true`** — Google nhận dạng trên máy (ADR 0002) | Android 13+ có `com.google.android.as` + gói vi-VN (app tự tải ngầm trên Android 14+ khi Wi-Fi). Máy không có → nút chạm. **Lệch BR-16:** Whisper tiny đo 0/6, Vosk small khoảng 7/12 → đã loại (số đo trong ADR 0002) |
| Accelerometer | `expo-sensors` | Fall detection |
| GPS | `expo-location` + `expo-task-manager` | Background location, low-power mode |
| Battery | `expo-battery` | Auto Minimal Mode < 10% |
| Haptics | `expo-haptics` | Kết hợp với mọi alert quan trọng |
| Network | `@react-native-community/netinfo` | Detect online/offline |
| Real-time | `@microsoft/signalr` | Hub `/hubs/location`: VIU nhận `ArrivalNotification`; GPS **không** đi qua hub. Từ backend `b878270` hub có thêm signaling WebRTC (`RelayOffer/Answer/IceCandidate`, event `WebRtc*`) — mobile chưa dùng, chờ chốt phạm vi (GAP-24) |
| Push | `@react-native-firebase/app` + `@react-native-firebase/messaging` | FCM token gửi kèm **`device.fcmToken` trong `/auth/login`** (không có endpoint đăng ký riêng); nhận notification |
| Secure storage | `expo-secure-store` | Access/refresh token, `client_device_id` |
| Local DB | `expo-sqlite` | Offline queue (GPS, logs), location cache, emergency contacts cache |
| Gọi điện trực tiếp | Native module dùng Intent `ACTION_CALL` (ví dụ `react-native-immediate-phone-call`) + quyền `CALL_PHONE` | SOS **tự quay số** — `tel:` qua `Linking` chỉ mở trình quay số, người khiếm thị vẫn phải tự tìm nút gọi → KHÔNG dùng `tel:` cho SOS |
| Zalo | `expo-linking` (Zalo deep link) | Khi contactType = `Zalo` / `Both` (dùng `zaloDeepLink` từ API) |
| Keep awake | `expo-keep-awake` | Trong navigation session |
| WebRTC | `react-native-webrtc` (native, cần config plugin Expo) | Gọi video/audio với Caregiver (mục 9.10). VIU **gửi video camera + nghe audio**, không xem video. Signaling qua hub `/hubs/location`; ICE từ `/api/webrtc/ice-servers/public` |

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
│       ├── ocr.tsx                       # QR Scanner UI
│       ├── read-text.tsx                 # OCR (đọc chữ) UI
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
│   │   ├── speech/SpeechService.ts       # Google STT online → nhận dạng trên máy (ADR 0002)
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
│       └── yolov8n_float16.tflite        # 6.4MB, chạy GPU delegate (lùi về CPU) — cách export: ADR 0001 §6.
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
| 15 | Cuộc gọi với người chăm sóc (WebRTC) | Call overlay (toàn cục) | Update Report §4 |

Ngoài màn hình: xem profile, đổi mật khẩu, logout (UC-3..6).

### App flow
```
Launch
 ├─ Chưa có token        → Login
 ├─ Role ≠ VisuallyImpaired → từ chối + logout (backend KHÔNG chặn role ở login — mobile tự chặn)
 ├─ privacyConsentAcceptedAt == null (hoặc privacyPolicyVersion ≠ bản hiện tại) → Privacy Consent (bắt buộc)
 └─ OK → Home
         ├─ Load: /users/me, /users/me/tts-preferences, /users/me/emergency-contacts (cache SQLite),
         │        /system-configs/public (ghi đè BusinessRules)
         ├─ FCM token: gửi kèm lúc login (device.fcmToken); Firebase đổi token → PUT /auth/fcm-token
         ├─ Connect SignalR (/hubs/location) — chỉ để nhận ArrivalNotification
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
Base URL:   EXPO_PUBLIC_API_BASE_URL   (server đã deploy: https://api.visionaid.net)
SignalR:    EXPO_PUBLIC_SIGNALR_URL    (https://api.visionaid.net/hubs/location)
Swagger:    https://api.visionaid.net/swagger/index.html — bản lưu: docs/api/openapi.json
Pattern:    /api/{resource} — không versioning
Transport:  HTTPS (domain api.visionaid.net). HTTP chỉ dùng khi chạy backend local ở build development
JSON:       camelCase; DateTimeOffset serialize theo giờ VN (+07:00)
```
> Swagger **không khai báo schema response** (mọi response 2xx đều trống) → muốn biết shape response phải đọc DTO trong source backend.

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
⚠️ Backend trả lỗi theo **2 dạng**, interceptor phải xử lý cả hai:
1. **ProblemDetails** (`application/problem+json`) từ `GlobalExceptionMiddleware` khi handler throw exception: Validation → 400 (key trong `errors` là tên property C# PascalCase), `UnauthorizedAccessException` → 401, `ForbiddenException` → 403, `NotFoundException` → 404, `ConflictException` → 409, `BusinessRuleException` → 422, còn lại → 500.
2. **`ApiResponse` với `success: false`** khi controller tự trả `BadRequest(result)` / `Unauthorized(result)` → đọc `errors[]`.

Ngoài ra còn **429** (rate limit `auth`: 10 request/phút cho login/register/forgot-password), body không theo ProblemDetails.

Axios interceptor chuẩn hóa mọi lỗi thành `AppError { status, title, detail, fieldErrors? }`. UI/TTS KHÔNG đọc nguyên văn `detail` tiếng Anh cho người dùng — map sang câu tiếng Việt thân thiện trong `strings.vi.ts`.

| Status | Xử lý phía mobile |
|---|---|
| 401 | Thử refresh token 1 lần → thất bại thì logout + TTS "Phiên đăng nhập đã hết hạn" |
| 403 từ `/auth/refresh` | **Mọi lỗi refresh đều trả 403** (token sai / reuse / hết hạn / user bị khóa) → logout + TTS "Phiên đăng nhập đã hết hạn" |
| 403 | TTS "Bạn không có quyền thực hiện thao tác này" |
| 429 | TTS "Bạn thử quá nhiều lần, vui lòng đợi một phút" |
| 402 | **License** (`LicenseValidationMiddleware`). Chính sách đã chốt (Update Report §3.4): `ACTIVE`/`TRIAL`/`EXPIRED ≤ 3 ngày` → mọi tính năng; `EXPIRED > 3 ngày` → **Navigation + SOS vẫn chạy**, tính năng khác bị chặn; `NONE` → **chỉ SOS**, Navigation bị chặn. TTS một lần mỗi lần mở app: gói dịch vụ bị dừng, liên hệ người chăm sóc, **vẫn gọi khẩn cấp được**. Đăng nhập vẫn vào app khi `/users/me` trả 402 (dùng thông tin trong response login). Hàng đợi offline giữ dữ liệu, gửi lại sau |
| Header `X-License-Warning: expiring-in-Nd` | Còn trong 3 ngày ân hạn → TTS "Gói dịch vụ sẽ hết hạn sau N ngày" một lần mỗi lần mở app |
| `licenseStatus` trong `/users/me` (backend `8f2641a`) | Báo trước ngay khi mở app / đăng nhập (`src/features/auth/licenseNotice.ts`): `None` hoặc hết hạn quá 3 ngày → như 402; còn ≤ 3 ngày → "sắp hết hạn"; `Trial` → báo còn bao nhiêu ngày dùng thử. **`None` → nút/lệnh "bắt đầu dẫn đường" bị từ chối kèm TTS hướng dẫn** (YOLO trên máy cũng không chạy, đúng chính sách); SOS luôn chạy. Dùng chung bộ chống lặp với 402 |
| 409 / 422 | Đọc thông điệp nghiệp vụ đã map |
| 5xx / timeout / offline | TTS "Tính năng tạm thời không khả dụng", đưa vào offline queue nếu là log |

### Endpoints mobile sử dụng
> Đã đối chiếu với source backend (2026-09-27). Mọi endpoint dưới đây **có thật**; thứ chưa có nằm ở mục 19 (GAP). Chi tiết auth: `docs/specs/auth.md`.

| Method | Endpoint | Body / ghi chú |
|---|---|---|
| POST | `/api/auth/login` | `{ email, password, device: { clientDeviceId, fcmToken?, deviceType: "Android", deviceModel?, appVersion? } }` → `ApiResponse<AuthTokenResponse>` `{ accessToken, refreshToken, expiresAt (hạn REFRESH token), userId, email, role, organizationId, privacyConsentAcceptedAt, privacyPolicyVersion }`. Sai mật khẩu → 401, tài khoản bị khóa → 403 |
| POST | `/api/auth/refresh` | `{ refreshToken, clientDeviceId }` → cặp token mới (cùng shape như login). Mọi lỗi → **403** |
| POST | `/api/auth/logout` | `{ clientDeviceId }` → revoke refresh token + tắt FCM của device |
| POST | `/api/auth/accept-privacy-policy` | `{ policyVersion }` |
| POST | `/api/auth/change-password` | `{ currentPassword, newPassword }` |
| PUT | `/api/auth/fcm-token` | `{ fcmToken, clientDeviceId, deviceType?, deviceModel?, appVersion? }`: gọi khi Firebase rotate token |
| GET / PUT | `/api/users/me` | GET → `UserResponse { id, email, fullName, phoneNumber, role, organizationId, isActive, avatarUrl, lastLoginAt, deletedAt, createdAt, updatedAt, privacyConsentAcceptedAt, privacyPolicyVersion }`. PUT `{ fullName?, phoneNumber?, avatarUrl? }` |
| GET / PUT | `/api/users/me/tts-preferences` | `{ voiceGender, speedRate?, volumeLevel?, detectionMode, primaryLanguage?, secondaryLanguage? }` |
| GET | `/api/system-configs/public?category=` | **Anonymous**. `PagedResult<{ configKey, configValue (string), valueType, category, minValue?, maxValue?, … }>`: ghi đè `BusinessRules` lúc runtime |
| GET | `/api/users/me/emergency-contacts` | `EmergencyContactResponse[] { id, contactName, contactType, phoneNumber?, zaloDeepLink?, priorityOrder, isActive, notes? … }` — VIU chỉ đọc |
| POST / GET | `/api/navigation/sessions` | POST `{ detectionMode, deviceModel?, appVersion?, startedAt? }` → session (có `id`) |
| PATCH | `/api/navigation/sessions/{id}/end` | `{ endedAt? }`. Session đã end → 422 |
| POST | `/api/navigation/sessions/{id}/events` | **Từng event một** (không phải batch): `{ objectClass, confidenceScore, distanceRange, boundingBox (string), alertIssued, inferenceTimeMs?, detectedAt, latitude?, longitude? }` |
| POST | `/api/navigation/sessions/{id}/events/batch` | Mảng các event như trên → `{ … số event, số alert }`. **Dùng cái này khi flush queue** |
| POST | `/api/navigation/guidance` | **Hybrid AI (backend `b878270`, mobile chưa tích hợp — GAP-23).** `{ sessionId (id phiên phía SERVER, phiên chưa kết thúc), frameId, detectedObjects: [{ class, confidence (0–1), distance: "MEDIUM"\|"FAR" (NEAR không gửi), position: "LEFT"\|"CENTER_LEFT"\|"CENTER"\|"CENTER_RIGHT"\|"RIGHT" }] }` → `{ logId, action: STOP\|TURN_LEFT\|TURN_RIGHT\|PROCEED, ttsText, engineUsed: Jev\|Groq\|RuleBased, isOfflineFallback, latencyMs }`. Mỗi request ghi một dòng `navigation_guidance_logs` |
| POST | `/api/webrtc/sessions`, `/{id}/accept`, `/{id}/reject`, `/{id}/end` | **WebRTC (backend `b878270`, chưa trong plan mobile — GAP-24).** Khi emergency event chuyển `Sent`, server tự tạo phiên `SosAuto` tới Caregiver chính và gửi `WebRtcIncomingCall { sessionId, callerId, callerName, triggerType, receiverRole: "video_sender" }` cho VIU |
| POST | `/api/ocr/requests` | multipart: `Image?`, `TriggerMethod`, `RawText?`, `ProcessedText?`, `ConfidenceScore?`, `OcrEngine`, `LanguageDetected?`, `ProcessingTimeMs?`, `ResultStatus`, `ErrorMessage?`, `TtsAnnounced`, `RequestedAt?`, `Latitude?`, `Longitude?`. **Có `Image` mà không có `ProcessedText` → server chạy VietOCR** (tách dòng + nhận dạng từng dòng) và bỏ qua validate `ResultStatus`/`OcrEngine`; trả `OcrRequestResponse { processedText, rawText, confidenceScore (xác suất thấp nhất giữa các dòng), ocrEngine, resultStatus (Success/Failed), serverOcrAvailable, … }`. `serverOcrAvailable = false` → VietOCR không chạy. Có `ProcessedText` → chỉ ghi log (offline). Xem 9.3 |
| POST | `/api/ocr/qr-scans` | multipart: `QrContent`, `QrType?`, `IsUrl`, `UrlDomain?`, `TriggerMethod`, `ResultStatus`, `ScannedAt?`, `Latitude?`, `Longitude?`, `Image?` … |
| POST | `/api/face-registry/identify` | multipart: **`photo`** (file), `latitude?`, `longitude?` → `IdentifyFaceResponse { recognized, lowConfidence, matchedPersonId?, matchedPersonName?, relationship?, similarityScore?, ttsText, engine, processingTimeMs }`. Server cắt mặt bằng MTCNN, ngưỡng `facenet_similarity_threshold` (mặc định 0.75), `lowConfidence` khi similarity trong [ngưỡng − 0.10, ngưỡng). **Server tự ghi log**. Ảnh không có mặt → **422** (detail tiếng Việt "Không tìm thấy khuôn mặt…"); FaceNet không chạy → 422 |
| ~~POST~~ | `/api/face-registry/recognition-logs` | Không dùng nữa (identify đã tự ghi log) |
| ~~GET~~ | `/api/face-registry/persons/me` | Không cần nữa (không nhận diện on-device) |
| POST | `/api/voice-commands` | **Từng log một**: `{ rawTranscript?, matchedCommand?, recognitionEngine? (chuỗi tự do), confidenceScore?, executionStatus, requiredConfirmation, confirmedAt?, processingTimeMs?, audioDurationMs?, isOffline, executedAt?, latitude?, longitude? }` |
| POST | `/api/locations/gps` | **Từng điểm một**: `{ clientGeneratedId, latitude, longitude, accuracyMeters?, altitude?, speedMps?, heading?, batteryLevel? (int), networkStatus, recordedAt, sessionId? }`. **Idempotent**: trùng `clientGeneratedId` → 200 "already recorded" (không trả 409). Response: `GpsRecordResponse { latitude, longitude, formattedAddress?, street?, district?, city?, recordedAt }` |
| POST | `/api/locations/gps/batch` | Mảng điểm GPS như trên → `{ accepted, skipped }` (tự bỏ qua trùng `clientGeneratedId`). **Dùng khi flush queue** |
| GET | `/api/locations/me` | Vị trí + địa chỉ đã cache gần nhất: `{ latitude, longitude, formattedAddress, street?, district?, city?, cachedAt, … }`; chưa có dữ liệu → 404 |
| POST | `/api/emergency-events` | `{ detectionMethod (chuỗi, parse không phân biệt hoa thường), latitude?, longitude?, accelerometerData? (string), notes?, snapshotBase64?, snapshotContentType?, detectedAt? }` → `EmergencyEventResponse` (có `id`). `AccelerometerCamera` → `Detected` + grace = `detectedAt` + 15s; loại khác → `Sent` ngay. Snapshot gửi **inline base64** (không có endpoint `/snapshot` riêng — GAP-11) |
| PUT | `/api/emergency-events/{id}/dismiss` | `{ notes? }`. Chỉ khi `Detected` và còn trong grace; quá grace → **422** |
| ~~PUT~~ | `/api/emergency-events/{id}/called` | **Chỉ Caregiver/CenterAdmin** (người chăm sóc đánh dấu đã gọi). Mobile KHÔNG gọi |

Không có: `/api/emergency-events/{id}/snapshot` (GAP-11) → xem mục 19.

> Từ backend `b878270`: vi phạm unique (Postgres 23505) trả **409 Conflict** thay vì 500. Hàng đợi offline của mobile phải coi 409 là "đã có trên server" (xóa item), không retry mãi.

### Enum serialization
Backend dùng `JsonStringEnumConverter` mặc định → enum trong JSON là **tên C# PascalCase**: `"AccelerometerCamera"`, `"Near"`, `"Minimal"`, `"Android"`, `"VisuallyImpaired"`. DB lưu SCREAMING_SNAKE nhưng **API không dùng dạng đó**. Role trong JWT và trong response cũng là PascalCase.

### Location format
Backend dùng **field phẳng** `latitude` / `longitude` (WGS84) trong body (GPS, emergency, OCR, voice, detection event) — KHÔNG lồng object `location`, KHÔNG gửi WKT.

---

## 7. ENUMS (khớp JSON của backend — PascalCase)

```ts
// src/constants/enums.ts — nguồn chuẩn là file này (đã đối chiếu với VisionAid-BE/src/Shared)
export type UserRole = 'Admin' | 'CenterAdmin' | 'Caregiver' | 'VisuallyImpaired';
// → So sánh role qua isVisuallyImpaired(role) trong src/utils/role.ts
export type TtsVoiceGender = 'Male' | 'Female';
export type DetectionMode = 'Minimal' | 'Full';
export type DistanceRange = 'Near' | 'Medium' | 'Far';
export type RecognitionResult = 'Matched' | 'NotMatched' | 'LowConfidence' | 'Error';
export type OcrRequestType = 'TextReading' | 'QrCode';
export type TriggerMethod = 'VoiceCommand' | 'Tap';
export type OcrResultStatus = 'Success' | 'LowConfidence' | 'Failed' | 'Retried';
export type DetectionMethod = 'AccelerometerCamera' | 'Manual' | 'VoiceCommand' | 'Gesture';
export type AlertStatus =
  | 'Detected' | 'Dismissed' | 'Sent' | 'Acknowledged' | 'Escalated' | 'Resolved' | 'Called';
export type CommandStatus = 'Success' | 'Failed' | 'Unrecognized' | 'Confirmed' | 'Cancelled';
export type RecognitionEngine = 'GoogleSpeech' | 'GoogleOnDevice'; // backend nhận chuỗi tự do — thống nhất giá trị với team
export type NetworkStatus = 'Wifi' | 'Mobile4G' | 'Mobile3G' | 'Offline';
export type DeviceType = 'Android' | 'Ios' | 'Web';
export type EmergencyContactType = 'Phone' | 'Zalo' | 'Both';
export type NotificationType =
  | 'FallDetected' | 'EmergencyManual' | 'GeofenceBreach' | 'ArrivalNotification' | 'SystemAlert';
```

---

## 8. AUTHENTICATION (client-side)

### Token storage
- `accessToken` (15 phút), `refreshToken` (30 ngày), `clientDeviceId` → **`expo-secure-store`**. KHÔNG lưu token trong AsyncStorage/SQLite/Zustand persist.
- `clientDeviceId`: UUID v4 sinh **một lần** khi cài app, lưu SecureStore, dùng cho cả refresh token và FCM token (backend match 2 bảng qua cột này khi logout).
- `expiresAt` trong response login/refresh là hạn của **refresh token** (30 ngày), không phải access token. Access token: 15 phút (production) / 60 phút (Development). Mobile không dựa vào thời hạn để refresh chủ động; chỉ refresh khi gặp 401.

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
4. Thất bại (backend trả 403 cho MỌI lỗi refresh — token reuse, hết hạn, account bị deactivate; xử lý cả 401 cho chắc)
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

### 9.1 Obstacle Detection + Hybrid AI Navigation
```
Camera (vision-camera) → frame processor (frame skipping) → resize/normalize
→ YOLOv8n inference (TFLite qua react-native-fast-tflite, 320×320) → NMS → lọc confidence >= yolo_confidence_threshold
→ ước lượng distance range → chọn object ưu tiên → TtsService.enqueue(priority)
```
- **Performance:** ≤ 500ms/cycle trên Android mid-range (Galaxy A-series, 4GB RAM); TTS từ lúc detect → phát âm ≤ 1s.
- **Frame skipping:** không inference mọi frame (ví dụ 2–4 fps inference), tùy chỉnh để giữ pin ≤ 20%/giờ.
- **Distance (BR-11, LI-01):** chỉ categorical `Near / Medium / Far`, ước lượng từ tỉ lệ bounding box so với frame (ngưỡng đặt trong `businessRules.ts`, tinh chỉnh khi benchmark). **KHÔNG BAO GIỜ đọc số mét/khoảng cách tuyệt đối.**
- **Priority (BR-12):** mỗi cycle chỉ announce object **gần nhất + nguy hiểm nhất** (sort: danger flag → distance Near>Medium>Far → confidence).
- **Cooldown (BR-13):** mỗi `object_class` tối thiểu **3s** (`tts_cooldown_seconds` từ `/system-configs/public`, mặc định `BusinessRules.TTS_COOLDOWN_SECONDS`) giữa 2 lần announce. **Ngoại lệ an toàn:** vật **gần hơn** lần đọc trước (Far → Medium → Near) được đọc ngay dù còn cooldown (`TtsRequest.urgency`).
- **Minimal Mode:** chỉ announce class có cờ `dangerous` trong `obstacleClasses.ts` (xe máy, ô tô, xe buýt, xe tải, xe đạp, bậc thang/hố... — danh sách chốt theo class model hỗ trợ). **Full Mode:** announce tất cả.
- **Câu TTS:** `"{Tên vật tiếng Việt} {ở gần | phía trước | ở xa}"` — ngắn gọn.
- **Logging:** ghi event (`objectClass`, `confidenceScore`, `distanceRange`, `boundingBox` — chuỗi JSON toạ độ chuẩn hoá 0–1, `alertIssued`, `inferenceTimeMs`, `detectedAt`, `latitude`, `longitude`) vào SQLite → flush định kỳ / khi online. Flush qua **`POST /navigation/sessions/{id}/events/batch`** (mỗi batch tối đa ~100 event; backend chưa đặt giới hạn nên client tự chia). Chỉ log event có `alertIssued = true` hoặc lấy mẫu để tránh phình dữ liệu.
- **Hybrid AI (Update Report §1, đã chốt; backend `POST /api/navigation/guidance`):**
  - **Layer 1 — trên máy (an toàn):** vật **NEAR** → TTS cảnh báo **ngay**, không gửi server, không chờ mạng.
  - **Layer 2 — server:** vật **MEDIUM/FAR** đóng gói `{ sessionId, frameId, detectedObjects: [{ class, confidence, distance: "MEDIUM"|"FAR", position }] }` → Decision Engine (JEV → Groq → Rule-Based) trả `action` (STOP / TURN_LEFT / TURN_RIGHT / PROCEED) + `ttsText` dựng từ **template cố định** (không phải LLM) → mobile đọc `ttsText`.
  - `position` chia khung hình theo tâm bounding box thành **5 dải ngang bằng nhau** (mỗi dải 20% chiều rộng): `LEFT` / `CENTER_LEFT` / `CENTER` / `CENTER_RIGHT` / `RIGHT` — khớp validator và luật của backend. Update Report §1.2 ghi `LEFT/CENTER/RIGHT` nhưng ví dụ JSON dùng `CENTER_RIGHT` → theo 5 dải.
  - Model YOLO vẫn là **float16 + GPU delegate** (ADR 0001, đo ~65 ms/cycle trên Galaxy S20 FE); Update Report ghi "INT8, 200–500 ms" là số cũ — SRS/slide cần sửa theo ADR 0001.
  - **Fallback trên máy:** offline, phiên chưa có id phía server, lỗi, hoặc quá `navigation_near_threshold_ms` (mặc định 500 ms, đọc từ `/system-configs/public`) → chạy **cùng luật Rule-Based** với server (chép từ `RuleBasedDecisionEngine.cs`: vật ở CENTER* → STOP; ở RIGHT → TURN_LEFT; ở LEFT → TURN_RIGHT; không có → PROCEED) và cùng template câu TTS (đặt trong `strings.vi.ts`).
  - Không gửi mỗi frame: chỉ gửi khi tập vật MEDIUM/FAR (class + distance + position) thay đổi, có giới hạn tần suất (chờ chốt với backend — GAP-23). Hướng dẫn rẽ/tránh dùng cooldown riêng, không đè cảnh báo NEAR (priority DANGER > INFO).
  - Bật/tắt bằng `hybrid_navigation_enabled`. License `NONE` → Navigation bị chặn (mục 6).
- **Session:** Start → `POST /navigation/sessions { detectionMode, deviceModel, appVersion, startedAt }` (nếu offline: tạo session local, sync sau với `startedAt` gốc) + bắt đầu GPS sharing (UC-22 included) + bật FallDetector. End → `PATCH /navigation/sessions/{id}/end { endedAt }`, tắt FallDetector.

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
- **OCR lai** (backend `a1e4df9`, cập nhật `b878270`):
  - **Online:** chụp → nén JPEG (cạnh dài ~1600px, < 1MB; server giới hạn 10MB) → `POST /api/ocr/requests` multipart gồm `Image`, `TriggerMethod`, `TtsAnnounced`; **không** gửi `ProcessedText`/`RawText`/`ConfidenceScore`. Backend không còn bắt validate `ResultStatus`/`OcrEngine` ở chế độ này, nhưng mobile vẫn gửi `ResultStatus=Failed`, `OcrEngine=pending` để khi VietOCR không chạy, log không bị ghi nhầm thành `Success`/`Tesseract` (mặc định của backend).
  - Đọc response: `serverOcrAvailable == false`, timeout (~8s) hoặc 5xx → **fallback ML Kit** trên máy. `serverOcrAvailable == true`: `processedText` có chữ và `confidenceScore` ≥ ngưỡng → TTS; rỗng (`Failed`) hoặc `confidenceScore` < ngưỡng → thử ML Kit, vẫn không được thì "Không đọc rõ, vui lòng chụp lại ở nơi đủ sáng" (BR-24). Ngưỡng OCR chưa có config key (GAP-25).
  - **Offline:** ML Kit Text Recognition (Latin, on-device) → TTS → log `/api/ocr/requests` với `ProcessedText`, `OcrEngine=mlkit`, không gửi ảnh, qua hàng đợi offline.
  - VietOCR đã tách dòng bằng projection ngang (OpenCV) trước khi nhận dạng; ảnh nghiêng hoặc nhiều cột có thể vẫn sai thứ tự dòng → đo trên máy thật.
  - Target ≤ 3s (P95). Hiện TTS "Đang đọc..." nếu > 1.5s.
- **QR:** decode on-device bằng code scanner → đọc nội dung qua TTS; nếu là URL → đọc domain + hỏi có mở không (xác nhận bằng giọng nói); log qua `POST /api/ocr/qr-scans` (multipart: `QrContent`, `QrType`, `IsUrl`, `UrlDomain`, `TriggerMethod`, `ResultStatus`, `ScannedAt`, `Latitude`, `Longitude`; queue nếu offline).
- VIU **không xem lại lịch sử OCR** trên app — lịch sử chỉ dành cho Caregiver trên web (BR-25).
- Offline → OCR bằng ML Kit (tiếng Việt kém hơn VietOCR); QR vẫn chạy bình thường.

### 9.4 Face Recognition (ONLINE)
- **Chạy trên server** (backend `a1e4df9`): chụp → nén JPEG → `POST /api/face-registry/identify` (multipart field **`photo`**, kèm `latitude`/`longitude`) → server tạo embedding FaceNet (vggface2, 512 chiều), tìm cosine bằng pgvector trong registry của VIU, **tự ghi log**. Mobile **không** gọi `/recognition-logs`, **không** tải `/persons/me`.
- `recognized: true` → TTS "{matchedPersonName} ({relationship}) ở phía trước" (dựng câu từ `strings.vi.ts`, không đọc `ttsText` của server). `lowConfidence: true` → "Chưa rõ, vui lòng hướng camera thẳng vào khuôn mặt". Còn lại → "Không nhận ra người này".
- 422 có hai nghĩa: không thấy khuôn mặt (detail "Không tìm thấy khuôn mặt…") → TTS hướng dẫn chụp lại gần, đủ sáng; FaceNet không chạy → "Tính năng nhận diện người quen tạm thời không khả dụng". Hai trường hợp chỉ phân biệt được qua `detail` (GAP-26). 5xx / timeout → "tạm thời không khả dụng".
- Server cắt và căn khuôn mặt bằng MTCNN cho cả upload lẫn identify; ngưỡng đọc từ `facenet_similarity_threshold` (backend `b878270`).
- **Privacy (BR-22):** ảnh tạm dùng để nhận diện **xóa khỏi thiết bị ngay** sau khi request xong (kể cả lỗi) — dùng `finally`. KHÔNG lưu vào gallery, KHÔNG cache, KHÔNG log.
- VIU **không quản lý** face registry — việc đó do Caregiver làm trên web.
- Offline → TTS: "Tính năng nhận diện người quen cần kết nối mạng".

### 9.5 Voice Commands (FE-09)
```
Kích hoạt (tự nghe khi mở app và sau mỗi kết quả đọc chữ/nhận diện; nút tăng/giảm âm lượng; nút trên Home) → Voice Listening Bottom Sheet + haptic + tiếng "bíp"
→ Online & Google STT OK ? Google Speech : Google nhận dạng trên máy (offline, Android 13+) : TTS hướng dẫn dùng nút
→ transcript → intent matcher (từ khóa trong voiceCommands.ts, không phân biệt dấu/hoa thường)
→ confidence thấp / không khớp → TTS "Tôi chưa hiểu, vui lòng nói lại" (`Unrecognized`)
→ lệnh nguy hiểm → Confirmation flow
→ thực thi → TTS xác nhận → log voice_command_logs (queue)
```
- **Kích hoạt không cần nhìn:** `VoiceProvider` (overlay toàn cục trong `app/(main)/_layout.tsx`) tự nghe khi mở app (im lặng → nhắc cách gọi) và sau mỗi kết quả (im lặng → không nói gì). Khi app đang mở, nút tăng/giảm âm lượng **không còn chỉnh âm lượng**: nhấn = bật/hủy nghe lệnh ở mọi màn hình (module local `modules/volume-key`). Âm lượng media đổi bằng lệnh "tăng âm lượng" / "giảm âm lượng", không xuống dưới 30% (mở app cũng nâng lên 30%) để người dùng luôn nghe được phản hồi. Sheet nghe lệnh là lớp phủ, không dùng `Modal` (Dialog riêng không nhận phím của Activity). Người dùng mở app rảnh tay bằng "Ok Google, mở VisionAid". Từ khóa đánh thức riêng chưa làm (pin, mic luôn bật, không có model tiếng Việt).
- **Fallback (BR-16, đã điều chỉnh — ADR 0002):** Google STT lỗi/offline → tự động Google nhận dạng trên máy + TTS: "Đang dùng nhận dạng giọng nói ngoại tuyến". Máy không nhận dạng trên máy được → TTS hướng dẫn dùng nút chạm.
- **Lệnh nguy hiểm (BR-14):** "Gọi khẩn cấp" → TTS "Bạn có chắc muốn gọi khẩn cấp? Nói 'đồng ý' để xác nhận" (đo trên máy: Google hay trả rỗng với từ 1 âm tiết "có", "đồng ý" nhận ngay lần đầu; vẫn chấp nhận "có", "xác nhận") → chờ tối đa **10s** → không xác nhận → tự hủy (`Cancelled`) + TTS thông báo đã hủy.
- Log (`POST /api/voice-commands`, **từng log một**): `rawTranscript`, `matchedCommand`, `recognitionEngine` (chuỗi tự do: `"GoogleSpeech"` / `"GoogleOnDevice"`), `confidenceScore`, `executionStatus`, `requiredConfirmation`, `confirmedAt`, `processingTimeMs`, `audioDurationMs` (để tính RTF), `isOffline`, `executedAt`, `latitude`, `longitude`.
- Target ≤ 2s end-to-end (online).

### 9.6 Location & GPS (FE-12, FE-13, FE-29)
- **Tracking:** `expo-location` background task (foreground service Android, thông báo thường trực). Mỗi điểm có `clientGeneratedId` (UUID) để server chống trùng khi retry.
  - **Luôn gửi qua REST `POST /api/locations/gps`** (từng điểm một), cả khi app ở foreground lẫn background. Hub SignalR **không có method nhận vị trí từ client**; server tự đẩy `LocationUpdated` cho Caregiver sau khi lưu.
  - Background task (headless JS) → ghi SQLite queue → gửi REST. KHÔNG phụ thuộc SignalR.
  - Endpoint **idempotent** theo `clientGeneratedId` (trùng → 200 "already recorded"), nên retry an toàn.
- **Phạm vi thời gian (cần chốt với team):** UC-22/23 gắn GPS sharing với navigation session (Start → bật, End → tắt). Nhưng geofence breach (FE-19, FE-29) cần GPS cả khi không navigate → đề xuất: ngoài session vẫn tracking **low-power** (tần suất thấp), trong session tracking tần suất cao.
- Payload: `clientGeneratedId, latitude, longitude, accuracyMeters, altitude, speedMps, heading, batteryLevel (int %), networkStatus, recordedAt, sessionId?`.
- **Offline:** lưu vào SQLite offline queue → khi online flush qua **`POST /api/locations/gps/batch`** (chia batch ~100 điểm; backend tự bỏ qua trùng `clientGeneratedId`).
- **Low-power:** giảm tần suất khi đứng yên; tăng tần suất khi đang di chuyển trong session.
- **"Tôi đang ở đâu?" (BR-15):**
  - Online → gửi điểm GPS hiện tại qua `POST /api/locations/gps` (response có `formattedAddress` mới nhất) — hoặc `GET /api/locations/me` nếu vừa gửi GPS gần đây → TTS địa chỉ → lưu cache SQLite (`formatted_address`, `cached_at`). `/locations/me` trả 404 khi chưa có dữ liệu → coi như chưa có vị trí.
  - Offline → đọc cache: "Vị trí gần nhất được ghi nhận lúc {HH:mm}, {ngày}: {địa chỉ}. Thông tin này có thể không còn chính xác."
  - Không có cache → "Chưa có thông tin vị trí đã lưu".
- **Arrival notification (BR-32):** server (BoundaryMonitor) phát hiện → SignalR event `ArrivalNotification` gửi group `viu_{userId}` với payload `{ viuId, savedLocationId, savedLocationName, ttsAnnouncement?, latitude, longitude, occurredAt }` → app TTS `savedLocationName` + `ttsAnnouncement` (nếu có) + haptic. Server **cũng gửi FCM** cho VIU (khi rule FCM cho `ArrivalNotification` bật) để thiết bị offline/background vẫn TTS được. Nếu app nhận cả hai thì phải dedupe theo `savedLocationId` + `occurredAt`.
- Geofence breach do server xử lý và báo Caregiver — app mobile không cần xử lý.

### 9.7 Emergency — Fall Detection & SOS (FE-10, FE-28)

**Fall detection (BR-26):** CHỈ trigger khi có **CẢ HAI** tín hiệu:
1. Accelerometer: gia tốc đột ngột vượt ngưỡng (key config độ nhạy chưa có trong danh sách sample keys của DB — TBC, ví dụ `fall_detection_sensitivity`)
2. Camera temporal logic: bất động kéo dài sau va chạm

Một tín hiệu đơn lẻ **KHÔNG BAO GIỜ** trigger alert.
> Hệ quả: vì cần tín hiệu camera, FallDetector **chỉ hoạt động khi đang trong navigation session** (camera bật). Ngoài session, fall detection không khả dụng — phải ghi rõ trong User Guide / Limitations.

**Luồng `AccelerometerCamera` (BR-27, BR-28):**
```
Phát hiện té ngã
→ POST /api/emergency-events { detectionMethod: "AccelerometerCamera", detectedAt (giờ thiết bị), accelerometerData (string), latitude, longitude, snapshotBase64?, snapshotContentType? }
   (server set Detected + grace_period_ends_at = detectedAt + 15s; trả về event có id)
→ Snapshot đi INLINE trong cùng request (snapshotBase64, JPEG đã nén nhỏ). Backend không có endpoint /snapshot riêng;
  upload MinIO lỗi thì server vẫn tạo event. Ảnh phải nén mạnh để không làm chậm việc tạo event (GAP-11: tách snapshot ra endpoint riêng)
→ Emergency SOS UI: đếm ngược 15s — TTS "Phát hiện té ngã. Nói tôi ổn, hoặc chạm vào màn hình để hủy cảnh báo." rồi chỉ đọc số ở 10 và 5
   (chừa khoảng lặng cho mic nghe "tôi ổn") + haptic mỗi giây; lắng nghe "tôi ổn" (xem quy tắc chống tự nghe bên dưới); chạm bất kỳ đâu trên màn hình = hủy
├── User hủy trong 15s → PUT /api/emergency-events/{id}/dismiss { notes? } → TTS "Đã hủy cảnh báo"
│     (quá grace → 422 "Grace period has expired" → TTS "Cảnh báo đã được gửi")
└── Hết 15s → server background job (EmergencyEventDispatcher) tự chuyển Sent + gửi Caregiver
      → app TTS "Đã gửi cảnh báo đến người chăm sóc" (Alert confirmation)
```
- Grace period được **server làm chuẩn** (source of truth); countdown trên app chỉ là UI. Việc dismiss phải gọi API trước khi server hết grace.
- `detectedAt` = **lúc đủ hai tín hiệu** (bắt đầu đếm ngược), không phải lúc va chạm — va chạm sớm hơn ≥ 5 s (chờ camera đứng yên) nên nếu gửi lúc va chạm, server hết grace trước khi đồng hồ trên máy về 0. Thời điểm va chạm nằm trong `accelerometerData`.
- Luôn gửi `detectedAt` từ thiết bị: event sync muộn từ offline queue → server tính grace từ thời điểm té thật (đã quá 15s → dispatcher gửi ngay). Đồng hồ thiết bị có thể lệch; backend chưa giới hạn `detectedAt` so với giờ server.
- ⚠️ **Chống tự nghe (echo) — CRITICAL:** câu TTS countdown chứa chính cụm "Tôi ổn", câu xác nhận SOS chứa "có" / "đồng ý". Nếu mic nghe trong lúc TTS đang phát, app sẽ **tự hủy cảnh báo té ngã / tự xác nhận SOS**. Bắt buộc: bỏ qua mọi transcript thu được trong lúc TTS đang phát (hoặc chỉ mở mic trong khoảng lặng giữa các lần đọc). Chạm màn hình là cách hủy chính, luôn hoạt động.
- **Offline khi té ngã (đề xuất — cần chốt với team):** lưu event vào queue; hết 15s mà vẫn offline và không bị hủy → tự gọi emergency contact ưu tiên 1 từ cache SQLite (ACTION_CALL, xem mục 2); khi có mạng sync event lên server.

**Luồng `Manual` / `VoiceCommand` / `Gesture`:**
```
Trigger (nút SOS / lệnh "gọi khẩn cấp" / cử chỉ) → Confirmation bắt buộc (10s timeout)
→ POST /api/emergency-events { detectionMethod: "Manual" | "VoiceCommand" | "Gesture", detectedAt, latitude, longitude }
   (server set Sent ngay, grace = NULL, tạo notification cho Caregiver)
→ TTS "Đã gửi cảnh báo khẩn cấp" → gọi emergency contact theo priorityOrder (Phone/Both: ACTION_CALL qua phoneNumber, Zalo: zaloDeepLink)
→ (Trạng thái `Called` do Caregiver/CenterAdmin đánh dấu qua PUT /{id}/called — mobile KHÔNG gọi endpoint này)
```
- Emergency contacts cache trong SQLite để dùng được khi offline.
- **Quyền `CALL_PHONE` xin trước** (lúc bắt đầu dẫn đường, mở màn khẩn cấp) — lúc khẩn cấp chỉ kiểm tra, chưa có quyền → mở trình quay số. Cuộc gọi **không chờ** gửi event (gửi chạy song song).
- **Không bao giờ nhận "đã xác nhận" từ route param / deep link:** lệnh giọng nói đặt cờ một lần trong bộ nhớ (5 s); `app/+native-intent.tsx` chặn deep link vào màn khẩn cấp.
- Hàng đợi `pending_emergency_events` giữ qua logout nhưng có `owner_id`: chỉ gửi khi đúng chủ đăng nhập.
- Link Zalo chỉ chấp nhận `https://zalo.me/…` hoặc `zalo://…`. **Standalone Mode** (VIU thuộc trung tâm, không có người thân): contacts do Staff Caregiver cấu hình, có thể gồm **112/113/114/115**, hotline trung tâm, số trực ban.
- ⚠️ Android **không cho `ACTION_CALL` gọi số khẩn cấp** (112, 113, 114, 115) — chỉ mở được trình quay số (`ACTION_DIAL`). Với các số này: mở trình quay số đã điền sẵn số + TTS "Chạm nút gọi màu xanh ở giữa phía dưới màn hình"; ưu tiên gọi trước contact không phải số khẩn cấp nếu có.
- Sau khi event chuyển `Sent`, server **tự mở cuộc gọi WebRTC `SOS_AUTO`** tới Caregiver chính (mục 9.10): app VIU bật camera gửi video + phát audio của Caregiver.
- KHÔNG bao giờ gọi acknowledge / escalate / resolve từ mobile — đó là hành động của Caregiver (backend cũng chặn theo role).
- Chỉ role VIU mới tạo/dismiss được event; VIU chỉ dismiss được event của chính mình.

### 9.8 Battery Monitor (FE-14, BR-17)
- Pin < **10%** → tự chuyển **Minimal Mode** + TTS "Pin yếu, đã chuyển sang chế độ tiết kiệm". Chỉ thông báo 1 lần mỗi lần xuống ngưỡng (không lặp).
- Gửi `batteryLevel` kèm mỗi điểm GPS.

### 9.9 Settings & Privacy
- TTS preferences: đồng bộ server, cache local để áp dụng ngay khi khởi động (kể cả offline).
- Privacy consent: hiển thị/đọc nội dung chính sách (thu thập GPS, ảnh khuôn mặt người quen) → chấp nhận bằng nút lớn hoặc giọng nói → `accept-privacy-policy` với `privacy_policy_version` hiện tại. Bản chính sách phải nói thêm: **video camera được truyền cho người chăm sóc trong cuộc gọi WebRTC** (kể cả cuộc gọi tự động khi SOS).

### 9.10 WebRTC — Gọi với người chăm sóc (Update Report §4, đã vào phạm vi)
- **3 cách kích hoạt:** Caregiver gọi từ dashboard (`CAREGIVER_INITIATED`), VIU nói **"gọi người chăm sóc"** (`VIU_VOICE_COMMAND` → `POST /api/webrtc/sessions`), hệ thống tự gọi khi SOS `Sent` (`SOS_AUTO`).
- **Vai trò VIU:** gửi **video camera sau + audio micro**, chỉ **nghe** Caregiver, không xem video (role `video_sender` trong `WebRtcIncomingCall`). Caregiver xem video và nói chuyện.
- **Nhận cuộc gọi không cần nhìn:** `WebRtcIncomingCall` → TTS "{callerName} đang gọi" + rung; `SOS_AUTO` tự nhận; cuộc gọi Caregiver chủ động: nhận bằng nút âm lượng / nút lớn / lệnh "nghe máy" (chờ chốt tự nhận hay không — GAP-24). Kết thúc: lệnh "kết thúc cuộc gọi", nút lớn, hoặc `WebRtcCallEnded`.
- **Signaling:** HTTP (`/api/webrtc/sessions`, `/{id}/accept|reject|end`) + hub `/hubs/location` (`RelayOffer` / `RelayAnswer` / `RelayIceCandidate`; event `WebRtcIncomingCall`, `WebRtcCallAccepted`, `WebRtcOffer`, `WebRtcAnswer`, `WebRtcIceCandidate`, `WebRtcCallEnded`, `WebRtcCallRejected`). ICE từ `/api/webrtc/ice-servers/public` (STUN Google + TURN Coturn).
- **Camera:** trong phiên dẫn đường camera đang dùng cho YOLO → khi cuộc gọi kết nối, tạm dừng nhận diện vật cản (TTS báo) và trả camera lại khi kết thúc, trừ khi backend/nhóm chốt khác (GAP-24).
- Bật/tắt bằng `webrtc_enabled`; tối đa `webrtc_max_duration_minutes` (60). Cuộc gọi đi qua mạng → offline thì TTS "cần kết nối mạng"; SOS vẫn gọi điện thoại như mục 9.7.

---

## 10. BUSINESS RULES CONSTANTS

```ts
// src/constants/businessRules.ts
// Giá trị mặc định, khớp VisionAid-BE/src/Shared/Common/BusinessRules.cs.
// Ghi đè lúc runtime bằng `GET /api/system-configs/public` (anonymous) theo `configKey` tương ứng.
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
// Hub [Authorize]; server đọc ClaimTypes.Role → VIU tự động join group "viu_{userId}"

// Server → Mobile (VIU) — event DUY NHẤT mobile cần:
"ArrivalNotification" → { viuId, savedLocationId, savedLocationName, ttsAnnouncement?, latitude, longitude, occurredAt }
                        → TTS + haptic (dedupe với FCM cùng sự kiện)

// Mobile → Server: GPS KHÔNG đi qua hub, gửi qua REST POST /api/locations/gps (mục 9.6).
// Từ backend b878270 hub có method signaling WebRTC (RelayOffer / RelayAnswer / RelayIceCandidate)
// và event WebRtcIncomingCall / WebRtcCallAccepted / WebRtcOffer / WebRtcAnswer / WebRtcIceCandidate /
// WebRtcCallEnded / WebRtcCallRejected — mobile chưa dùng, chờ chốt phạm vi (GAP-24).
```
- Kết nối lại khi app từ background → foreground và khi mạng có lại.
- SignalR chỉ dùng để nhận; GPS không phụ thuộc vào trạng thái kết nối hub.
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
| 13 | "tăng âm lượng" / "giảm âm lượng" (cũng nhận "to lên", "nhỏ lại") | Tăng / giảm âm lượng media (±15%, tối thiểu 30%) — thay cho phím âm lượng | ❌ |
| 14 | "gọi người chăm sóc" | Gọi WebRTC tới Caregiver chính (`VIU_VOICE_COMMAND`) | ❌ (không phải gọi khẩn cấp) |
| 15 | "kết thúc cuộc gọi" | Kết thúc cuộc gọi WebRTC | ❌ |

---

## 13. OFFLINE STRATEGY

| Tính năng | Offline? | Hành vi khi mất mạng |
|---|---|---|
| Obstacle detection | ✅ | Chạy bình thường |
| Voice commands | ⚠️ | Android 13+ có gói vi-VN: nhận dạng trên máy + TTS thông báo; máy khác: nút chạm (ADR 0002) |
| QR decode | ✅ | Đọc nội dung, log vào queue |
| TTS | ✅ | Bình thường (đảm bảo gói giọng `vi-VN` đã cài — kiểm tra khi khởi động, hướng dẫn cài nếu thiếu) |
| Fall detection | ✅ phát hiện | Event vào queue; fallback gọi emergency contact (xem 9.7) |
| OCR | ⚠️ | ML Kit trên máy, log vào queue |
| Face Recognition | ❌ | TTS "cần kết nối mạng" |
| "Tôi đang ở đâu" | ⚠️ | Địa chỉ cache + timestamp (BR-15) |
| GPS sharing | ⚠️ | Lưu SQLite, flush khi online |
| Hướng dẫn rẽ/tránh (Hybrid) | ⚠️ | Rule-Based trên máy (cùng luật + câu với server); NEAR luôn trên máy |
| WebRTC | ❌ | TTS "cần kết nối mạng" |

**Offline queue (SQLite):** bảng `pending_gps`, `pending_detection_events`, `pending_voice_logs`, `pending_qr_logs`, `pending_emergency_events`. Flush theo thứ tự ưu tiên: emergency → GPS → logs. GPS và detection event flush bằng **endpoint batch** (chia lô ~100); voice log / QR log / emergency gửi từng item. Retry với exponential backoff; xóa item khi server trả 2xx (GPS trùng `clientGeneratedId` cũng trả 200). Các lỗi 4xx vĩnh viễn (400/422, trừ 401/429) → bỏ item, log cảnh báo, để khỏi kẹt queue. Giới hạn dung lượng queue (drop log cũ nhất trước, KHÔNG BAO GIỜ drop emergency).

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
RECEIVE_BOOT_COMPLETED (expo-task-manager lưu lịch task GPS nền)
MODIFY_AUDIO_SETTINGS (WebRTC: loa ngoài khi gọi)
```
- Xin quyền theo ngữ cảnh, **giải thích bằng TTS trước** khi hiện dialog hệ thống.
- Background location xin riêng sau khi có foreground location (yêu cầu của Android).
- minSdk tương ứng Android 10 (API 29).

---

## 15. ENVIRONMENT CONFIG

```bash
# .env.example — chỉ biến PUBLIC (được bundle vào app, KHÔNG đặt secret ở đây)
EXPO_PUBLIC_API_BASE_URL=https://api.visionaid.net          # server backend đã deploy (HTTPS)
EXPO_PUBLIC_SIGNALR_URL=https://api.visionaid.net/hubs/location
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_PRIVACY_POLICY_VERSION=1.0
```
- Chạy backend local thay vì server deploy: Docker Compose map API ra cổng **5002** (`5002:8080`) → emulator dùng `http://10.0.2.2:5002`, máy thật dùng IP LAN của máy dev (ví dụ `http://192.168.1.x:5002`). `10.0.2.2` chỉ dùng được trên **emulator**.
- Android 9+ chặn HTTP cleartext mặc định → chỉ bật `usesCleartextTraffic` cho build **development** (qua `expo-build-properties`), tắt ở staging/production.
- `google-services.json` (Firebase) — không commit nếu repo public; cấu hình qua EAS secrets.
- **KHÔNG nhúng** API key Mapbox, Google Cloud, AES key hay bất kỳ secret nào vào app. Mapbox/Google gọi qua Backend.
- Backend local: `docker-compose up` trong `../VisionAid-BE` (API 5002, MinIO 9010/9011; Postgres 5432 và Redis 6379 chỉ mở qua `docker-compose.override.yml`).

---

## 16. CODING RULES — BẮT BUỘC

### General
1. TypeScript strict, không `any`, không `// @ts-ignore` khi chưa giải thích lý do.
2. Function components + hooks. Không class components.
3. Screen trong `app/` mỏng — logic trong `src/features/*` và `src/services/*`.
4. Không hard-code config/ngưỡng — dùng `BusinessRules` (giữ khớp `BusinessRules.cs` của backend; ghi đè runtime bằng `/system-configs/public`).
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
17. `AccelerometerCamera` chỉ trigger khi đủ 2 tín hiệu (BR-26); luôn có 15s grace period có thể hủy bằng chạm hoặc giọng nói.
18. `Manual / VoiceCommand / Gesture` không có grace period nhưng **bắt buộc** confirmation 10s trước khi gửi (BR-14).
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
  ✦ SpeechService: Google STT (online) → Google nhận dạng trên máy (offline) — ADR 0002
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

Sprint 7 — Emergency + License policy
  ✦ FallDetector (accelerometer + camera immobility)
  ✦ Fall countdown UI (TTS + haptic, dismiss by tap/voice)
  ✦ SOS manual / voice / gesture + emergency contacts calling (số khẩn cấp 112/115 → ACTION_DIAL)
  ✦ Battery monitor auto Minimal Mode
  ✦ License: NONE chặn dẫn đường, Trial đếm ngày, SOS không bao giờ bị chặn

Sprint 8 — Hybrid AI Navigation + WebRTC (Update Report 28/9)
  ✦ Position 5 dải + gửi MEDIUM/FAR lên /api/navigation/guidance, đọc ttsText
  ✦ Rule-Based + template trên máy khi offline / quá navigation_near_threshold_ms
  ✦ WebRTC: nhận cuộc gọi (TTS + rung), SOS_AUTO tự nhận, "gọi người chăm sóc", gửi video + nghe audio
  ✦ Nhường camera giữa YOLO và cuộc gọi

Sprint 9 — Settings, Hardening & Release
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
| `refresh_tokens`, `fcm_device_tokens` | Gián tiếp qua `/auth/login` (FCM trong `device`), `/auth/refresh`, `/auth/logout` | Khớp nhau bằng `client_device_id` |
| `user_tts_preferences` | Đọc/ghi qua `/users/me/tts-preferences` | 1-1 với user |
| `emergency_contacts` | Chỉ đọc | Caregiver quản lý; sort `priority_order ASC`, tối đa 5 |
| `obstacle_detection_sessions` / `_events` | Ghi | Event flush theo batch (`/events/batch`) |
| `ocr_requests`, `qr_scan_results` | Ghi log (qua API) | VIU không xem history |
| `face_registry_persons` / `_images` | Không trực tiếp | Caregiver quản lý; server tự tạo embedding khi upload |
| `face_recognition_logs` | Gián tiếp (server ghi khi gọi `/face-registry/identify`) | |
| `location_history` | Ghi | `client_generated_id` UNIQUE, endpoint idempotent |
| `location_cache` | Server cập nhật khi nhận GPS; mobile đọc qua `/locations/me` hoặc response `/locations/gps` | Mobile có bản cache SQLite riêng |
| `saved_locations`, `geofences` | Không trực tiếp | Server xử lý boundary, gửi ArrivalNotification (SignalR + FCM) |
| `emergency_events` | Tạo + dismiss | State machine mục 9.7; `Called` do Caregiver đánh dấu |
| `voice_command_logs` | Ghi | RTF = processing_time_ms / audio_duration_ms |
| `system_configurations` | Đọc `/system-configs/public` (anonymous) | Ghi đè BusinessRules |

---

## 19. GAP VỚI BACKEND (đối chiếu source, cập nhật 2026-10-06 sau commit `b878270`)

> Những thứ mobile cần nhưng backend **chưa có**. Khi được bổ sung thì sửa mục liên quan và chuyển dòng sang bảng "Đã xử lý". Chi tiết auth: `docs/specs/auth.md`.

### Còn mở
| # | Chặn | Thiếu gì | Đề xuất cho backend | Tạm thời phía mobile |
|---|---|---|---|---|
| GAP-11 | Sprint 7 | Snapshot chỉ inline base64 trong request tạo event (đã có `snapshotContentType`) | Endpoint `/emergency-events/{id}/snapshot` riêng | Nén JPEG mạnh (≤ ~150KB) trước khi gửi |
| GAP-13 | Mọi sprint | Lỗi lúc là ProblemDetails, lúc là `ApiResponse{success:false}` | Thống nhất một dạng | `src/api/client.ts` xử lý cả hai |
| GAP-14 | Sprint 3/6 | Endpoint batch (`/locations/gps/batch`, `/events/batch`) chưa giới hạn số phần tử | Thêm giới hạn (ví dụ ≤ 500/lô) | Client tự chia lô ~100 |
| SEC | Ngay | `appsettings.Development.json` (đang commit) chứa khóa thật Resend + **PayOS `ChecksumKey`** (giả mạo được webhook → kích hoạt license miễn phí); `DbSeeder` seed tài khoản mặc định ở mọi môi trường | Rotate khóa, chuyển secret ra biến môi trường, chỉ seed ở Development | — |
| GAP-23 | Sprint 8 (Hybrid AI) | **Phạm vi đã chốt (Update Report §1).** Còn hỏi: tần suất gọi (mỗi request ghi 1 dòng log, YOLO ~3 lần/giây); Groq không có timeout nên tổng thời gian có thể vượt `navigation_near_threshold_ms`; `class` bị đọc nguyên văn trong `ttsText` (báo cáo dùng `"motorbike"` → "Có motorbike phía…"); ranh giới 5 dải `position`; cần `sessionId` phía server (phiên offline chưa có). `distance`/`position` so khớp không phân biệt hoa thường — không cần đổi | Trả lời các câu hỏi; map class sang tiếng Việt phía server hoặc quy ước mobile gửi tên tiếng Việt | Rule-Based + template trên máy khi chưa gọi được server |
| GAP-24 | Sprint 8 (WebRTC) | **Phạm vi và vai trò đã chốt** (VIU gửi video + nghe audio). Theo code: VIU (`video_sender`) luôn tạo offer sau `WebRtcCallAccepted` — tài liệu backend §23 (VIU `audio_receiver`, Answer trước Offer) cần sửa cho khớp. **Lỗi:** phiên `SosAuto` có `initiator_id = NULL` → `LocationHub.ComputeTargetGroup` không tìm được Caregiver khi VIU relay offer/ICE → `HubException`, cuộc gọi SOS không kết nối được | Sửa `ComputeTargetGroup` (VIU → `receiver_id` khi `initiator_id` null); sửa tài liệu §23 | Chưa làm WebRTC. Tự nhận cuộc gọi Caregiver chủ động và nhường camera là quyết định của nhóm/mobile |
| GAP-25 | Sprint 5 (OCR) | Không có config ngưỡng confidence OCR; `resultStatus` chỉ `Success`/`Failed`, không có `LowConfidence`. VietOCR không chạy mà mobile không gửi `ResultStatus`/`OcrEngine` → log ghi `Success` + `Tesseract` | Thêm `ocr_confidence_threshold` + trả `LowConfidence`; khi VietOCR không chạy đặt `Failed` | Mobile vẫn gửi `ResultStatus=Failed`, `OcrEngine=pending`; ngưỡng tạm phía client |
| GAP-26 | Sprint 5 (Face) | **Lỗi:** `FaceNetService` ném `BusinessRuleException` "Không tìm thấy khuôn mặt…" bên trong `try`, nhưng `catch (Exception)` nuốt mất và trả `null` → client luôn nhận "service unavailable" (422), không bao giờ biết là không thấy mặt. Upload ảnh Caregiver không có mặt cũng âm thầm lưu không embedding | Không bắt `BusinessRuleException` trong `catch`; thêm mã lỗi riêng (`errorCode: NoFaceDetected` hoặc 503 khi service lỗi); báo Caregiver khi ảnh upload không có mặt | Đọc chung một câu "chưa nhận diện được, chụp lại gần hơn, đủ sáng" cho 422 |
| GAP-27 | Sprint 6 (FCM) | `google-services.json` chỉ có `vn.visionaid.mobile`, thiếu `vn.visionaid.mobile.dev` → bản dev build lỗi; payload FCM `ArrivalNotification` chỉ có `notificationId`/`notificationType`, thiếu `savedLocationId`/`savedLocationName`/`ttsAnnouncement`/`occurredAt` và luôn kèm `Notification` (Android tự hiện, app không TTS khi chạy nền) | Thêm app `.dev` vào Firebase project `visionaid-firebase-5cccb`; thêm field vào `data`, gửi data-only + priority high cho VIU | Code FCM đã xong, bỏ qua payload thiếu field |
| GAP-28 | Ngay | `DbSeeder`: gói license **và các config mới** (`hybrid_navigation_*`, `navigation_near_threshold_ms`, `webrtc_*`, `payos_*`, `trial_days_default`…) chỉ seed khi DB trống → DB production cũ không có. License `NONE` chặn `/api/navigation/*` là **đúng chính sách** (Update Report §3.4); chỉ cần sửa câu rule 20–22 của backend cho rõ | Seed theo từng key/`Code`; sửa câu rule | — |
| GAP-29 | Sprint 8 | `navigation_near_threshold_ms`, `hybrid_navigation_enabled`, `webrtc_enabled`, `webrtc_max_duration_minutes` seed với `isPublic: false` → `/api/system-configs/public` không trả, mobile không đọc được | Đặt `isPublic: true` cho các key mobile cần | Dùng mặc định cứng (500 ms, bật) |
| GAP-30 | Sprint 8 | `LicenseValidationMiddleware` không miễn `/api/webrtc/sessions*` → VIU license `NONE` / hết hạn > 3 ngày bị 402 khi nhận, gọi hoặc kết thúc cuộc gọi, kể cả cuộc gọi `SosAuto` (trái "SOS không bao giờ bị chặn") | Miễn kiểm tra license cho phiên có `emergency_event_id` (hoặc toàn bộ `/api/webrtc/sessions` của VIU) | — |
| GAP-31 | Sprint 7 | `POST /api/emergency-events` không có khóa chống trùng → request timeout sau khi server đã tạo xong thì mobile đưa vào hàng đợi và tạo **event thứ hai** (Caregiver nhận 2 cảnh báo; hủy té ngã chỉ hủy được một) | Nhận `clientGeneratedId` như GPS, trùng → trả event cũ | — |

### Đã xử lý (commit `f4e2592`, `41bed01`, `8f2641a`, `a1e4df9`, `b878270`)
| # | Kết quả |
|---|---|
| GAP-18 | (`b878270`) VietOCR tách dòng (OpenCV projection) rồi nhận dạng từng dòng |
| GAP-19 | (`b878270`) Gửi ảnh online không còn bắt `ResultStatus`/`OcrEngine`; response có `serverOcrAvailable` |
| GAP-20 | (`b878270`) MTCNN cắt + căn khuôn mặt; không có mặt → 422 |
| GAP-21 | (`b878270`) Ngưỡng từ `facenet_similarity_threshold` (0.75), thêm `LowConfidence` / `lowConfidence` |
| GAP-22 | (`b878270`) `confidence` = xác suất thấp nhất giữa các dòng |
| GAP-17 | (`b878270`) Đã có endpoint Hybrid Navigation và signaling WebRTC; câu hỏi còn lại chuyển sang GAP-23, GAP-24 |
| GAP-3 | (`a1e4df9`) OCR lai: `/ocr/requests` có ảnh, không có `ProcessedText` → server chạy VietOCR; offline client gửi text như cũ |
| GAP-4 | (`a1e4df9`) `POST /face-registry/identify` nhận diện trên server, tự ghi log; upload ảnh tự tạo embedding |
| GAP-1 | `privacyConsentAcceptedAt`, `privacyPolicyVersion` có trong `UserResponse` và `AuthTokenResponse` |
| GAP-5 | `GET /locations/me` + `/locations/gps` trả `GpsRecordResponse` có địa chỉ |
| GAP-6 | `GET /system-configs/public` (anonymous) |
| GAP-7 | `PUT /auth/fcm-token` |
| GAP-9 | Emergency nhận `detectedAt`; grace tính từ `detectedAt` |
| GAP-10 | `POST /locations/gps/batch`, `POST /navigation/sessions/{id}/events/batch` |
| GAP-8 | HTTPS + domain: `https://api.visionaid.net` (2026-09-28). Cleartext vẫn chỉ bật ở build development cho backend local |
| GAP-12 | `PUT /emergency-events/{id}/called` — **dành cho Caregiver/CenterAdmin**, mobile không gọi |
| GAP-2 | Không đổi (mobile tự chặn role) — chấp nhận |
| GAP-15 | (`8f2641a`) License NULL = None; `/api/users/me*` luôn qua license check (kể cả emergency-contacts, tts-preferences); VIU B2C thừa hưởng license của Caregiver chính (`LicenseCacheSyncJob` mỗi giờ + ngay khi Caregiver tạo VIU). Lưu ý: Caregiver kích hoạt gói sau khi đã có VIU → VIU chờ tới lượt sync (≤ 1 giờ + cache Redis 5 phút) |
| GAP-16 | (`8f2641a`) `UserResponse` và `AuthTokenResponse` có `licenseStatus` (`Trial`/`Active`/`Expired`/`None`, có thể null) và `licenseExpiresAt` |

---

## 20. LIMITATIONS & GUARDRAILS (Update Report §6 — đưa vào SRS, User Guide, slide)

- **Phụ kiện bắt buộc:** túi đeo ngực (chest strap) cố định điện thoại ngang tầm nhìn, camera sau hướng về phía trước. Ngưỡng khoảng cách Near/Medium/Far và ước lượng vị trí trái/phải hiệu chỉnh theo tư thế này.
- **Điểm mù camera:** không phát hiện hố sâu, mép vỉa hè (camera nhìn ngang), biển báo quá cao, vật ngoài góc nhìn.
- **Ánh sáng yếu, mưa:** độ chính xác giảm.
- **Bắt buộc dùng kèm gậy trắng hoặc gậy IoT** — VisionAid không thay thế công cụ hỗ trợ hiện có.
- **Fall detection chỉ hoạt động trong phiên dẫn đường** (cần camera, BR-26).
- **Gọi số khẩn cấp (112/115):** Android không cho app tự quay; app mở trình quay số và hướng dẫn bằng giọng nói.

---

*Scope: Mobile App (React Native + Expo) cho Visually Impaired User — Android 10+*
*Backend: ASP.NET Core 9 Modular Monolith (repo riêng) — DB v8.0 (27 bảng)*
*Last updated: 2026-09-27 — Sprint 2 đang làm; contract API khớp backend commit `41bed01` (mục 6, 9, 19)*
