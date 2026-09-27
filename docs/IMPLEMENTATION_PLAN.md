# VisionAid Mobile: Kế hoạch triển khai và cách dùng skill/plugin

> Tài liệu làm việc cho các Sprint 2–8 (mục 17 trong CLAUDE.md). Mỗi sprint ghi rõ **dùng skill nào, lúc nào, để làm gì**.
> Đặc tả nghiệp vụ vẫn lấy từ `CLAUDE.md`; file này chỉ nói _cách làm_.

---

## 0. Thứ tự ưu tiên khi các skill mâu thuẫn nhau

Đã cài 3 plugin và 1 skill riêng: **agent-skills** (addy), **expo** (claude-plugins-official, phạm vi project), **ponytail** (bật mặc định ở mức `full` qua hook), **graphify**.

Khi có xung đột, thứ tự ưu tiên là: **CLAUDE.md > CONSTRAINTS.md (sẽ tạo) > skill**. Các xung đột đã biết:

| Xung đột                                                                                                        | Quy tắc áp dụng                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/build` (agent-skills) chạy vòng _build → test → verify → **commit**_; `git-workflow-and-versioning` tự commit | **CLAUDE.md §0 thắng**: agent chỉ đề xuất commit message, **không tự chạy git**. Khi gọi `/build`, luôn kèm câu "không commit".                                                                                                                                                             |
| Ponytail nói "chỉ cần MỘT check chạy được, không viết test suite"                                               | **CLAUDE.md §16.21 thắng**: bắt buộc có unit test cho TtsService, distance estimator, priority selector, intent matcher, confirmation flow, echo guard, FallDetector, offline queue, refresh single-flight; coverage logic ≥ 70%. Chỉ áp ponytail cho _code production_, không áp cho test. |
| Ponytail "shortest diff" với code khẩn cấp và auth                                                              | Ponytail tự loại trừ "error handling, security, accessibility". Với Sprint 2 (auth) và Sprint 7 (emergency) nên hạ xuống `/ponytail lite`.                                                                                                                                                  |
| Các skill `eas-*` (dịch vụ trả phí) có thể chạy `eas build/update/submit`                                       | **CLAUDE.md §0**: không chạy khi user chưa xác nhận.                                                                                                                                                                                                                                        |
| `expo-project-structure` khuyên đặt route trong `src/app/`                                                      | Giữ `app/` ở root theo CLAUDE.md §3.                                                                                                                                                                                                                                                        |
| `expo-native-ui` đi theo Apple HIG                                                                              | Chỉ tham khảo. Nền tảng chính là Android + high-contrast; a11y theo CLAUDE.md §5.                                                                                                                                                                                                           |

**Không dùng** cho repo này: `browser-testing-with-devtools`, `/webperf` + `web-performance-auditor`, `eas-hosting`, `expo-app-clip`, `expo-brownfield`, `expo-dom`, `expo-web-to-native`, `eas-simulator` (chỉ có simulator iOS/Android trên cloud; camera/sensor cần máy thật).

---

## 1. Bản đồ skill theo mục đích

| Nhu cầu                                      | Skill / lệnh                                                                    | Ghi chú                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| Chốt yêu cầu / API còn TBC                   | `/spec` (spec-driven-development), `interview-me`, `idea-refine`                | Dùng trước mỗi sprint có endpoint TBC              |
| Chia task                                    | `/planning` (planning-and-task-breakdown)                                       | Ra danh sách task có acceptance criteria           |
| Tra tài liệu chính thức                      | `source-driven-development`, `expo-overview` → skill expo-* tương ứng           | Expo đổi API qua từng SDK; **luôn tra docs v57**   |
| Viết logic có test                           | `/test` (test-driven-development)                                               | Bắt buộc cho các module ở §16.21                   |
| Code từng lát nhỏ                            | `/build` + `incremental-implementation`                                         | **Không commit**                                   |
| Networking / TanStack Query / offline        | `expo-data-fetching`, `api-and-interface-design`                                |                                                    |
| Routing / guard                              | `expo-router`                                                                   | `Stack.Protected` đang dùng                        |
| Dev build lên máy thật                       | `expo-dev-client`                                                               | Mỗi lần thêm native module                         |
| Viết native module (frame processor ONNX...) | `expo-module`                                                                   | Chỉ dùng khi thư viện có sẵn không đáp ứng         |
| UI trợ năng                                  | `frontend-ui-engineering`, `expo-design-system`, `expo-ui` (BottomSheet)        | Kiểm tra với TalkBack                              |
| Hiệu năng (YOLO ≤ 500ms, pin)                | `performance-optimization`                                                      |                                                    |
| Logging / đo lường                           | `observability-and-instrumentation`, `eas-observe` (trả phí, tùy chọn)          |                                                    |
| Bảo mật                                      | `security-and-hardening`, agent `security-auditor`                              | Bắt buộc cho auth, ảnh khuôn mặt, emergency        |
| Soát quyết định rủi ro cao                   | `doubt-driven-development`                                                      | Risk #2 (AI on-device), echo guard, fall detection |
| Debug                                        | `debugging-and-error-recovery`                                                  |                                                    |
| Review trước merge                           | `/review` (code-review-and-quality), agent `code-reviewer`, `/ponytail-review`  |                                                    |
| Test chiến lược / bù coverage                | agent `test-engineer`                                                           |                                                    |
| Ghi quyết định                               | `documentation-and-adrs` → `docs/adr/`                                          |                                                    |
| Ngưỡng chất lượng                            | `/constraints` → `CONSTRAINTS.md`                                               | Làm 1 lần ở Sprint 2                               |
| CI                                           | `ci-cd-and-automation` (GitHub Actions) hoặc `eas-workflows` (trả phí)          |                                                    |
| Phát hành                                    | `/ship` (shipping-and-launch), `eas-app-stores`, `eas-update`                   | Cần user xác nhận                                  |
| Dọn over-engineering                         | `/ponytail-review` (theo diff), `/ponytail-audit` (toàn repo), `/ponytail-debt` |                                                    |
| Hiểu kiến trúc khi repo lớn                  | `/graphify`                                                                     | Chạy từ Sprint 4 trở đi, `--update` mỗi sprint     |
| Session bị rối / mất ngữ cảnh                | `context-engineering`                                                           |                                                    |

---

## 2. Vòng làm việc chuẩn cho mỗi feature

```
1. /spec          → nếu feature có endpoint/hành vi TBC (ghi vào docs/specs/<feature>.md)
2. /planning      → chia task nhỏ, mỗi task ≤ ~½ ngày, có acceptance criteria
3. source-driven-development + expo-*  → tra docs trước khi dùng API Expo/thư viện native
4. /test          → viết test đỏ cho logic (services/stores/utils/features)
5. /build         → code từng lát, "không commit"
6. npm run typecheck && npm run lint && npm test
7. /review + /ponytail-review   (thêm security-auditor nếu đụng auth/ảnh/emergency)
8. Thử trên máy Android thật (dev build) với TalkBack bật + tắt
9. User tự commit (agent đề xuất message semantic)
```

Nhánh git gợi ý: `feat/<sprint>-<feature>`, merge vào `main` sau bước 7–8.

---

## 3. Việc làm một lần (đầu Sprint 2)

| #   | Việc                                                                                                                  | Skill                                     | Kết quả                          |
| --- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------- |
| S1  | Chuyển các ngưỡng trong CLAUDE.md (coverage 70%, YOLO 500ms, TTS 1s, OCR 3s P95, pin 20%/h, a11y 48dp) thành hợp đồng | `/constraints`                            | `CONSTRAINTS.md`                 |
| S2  | CI: typecheck + lint + jest trên mỗi PR                                                                               | `ci-cd-and-automation`                    | `.github/workflows/ci.yml`       |
| S3  | Build dev client, cài lên máy Android thật (hoàn tất Sprint 1)                                                        | `expo-dev-client`                         | APK dev chạy được trên máy       |
| S4  | Kiểm tra gói giọng `vi-VN` lúc khởi động (§13)                                                                        | `source-driven-development` (expo-speech) | Hướng dẫn cài bằng TTS nếu thiếu |
| S5  | Xác thực Expo MCP (plugin expo) để tra docs/EAS                                                                       | `mcp__plugin_expo_expo__authenticate`     | Tùy chọn                         |

---

## 4. Kế hoạch theo sprint

Trạng thái Sprint 1: ✅ scaffold, lint/test, constants, TtsService + test, Haptic, NetworkMonitor, SQLite, secureStorage, component a11y, dev build chạy trên máy Samsung thật, TTS `vi-VN` OK (S3, S4 xong 2026-09-27). Nút "Vào màn hình chính (dev)" ở Login là tạm, xóa ở Sprint 2.

### Sprint 2: Auth + Prototype AI (Risk #2)

**Trạng thái (2026-09-27): ✅ Xong.** Auth (login, chặn role, privacy consent, logout, bootstrap offline) + design system; prototype YOLOv8n TFLite chạy trên máy thật, **ADR 0001 đã chấp nhận** (float16 + GPU: khoảng 30 ms inference, khoảng 65 ms toàn chu kỳ). Mang sang Sprint 3: tự lùi GPU → CPU trong hook detector thật, bỏ màn Detector Lab khi Home có camera.

`/ponytail lite` cho phần auth.

| Task                                                                                        | Skill                                                                                 | Done khi                                                                             |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Chốt contract: login/refresh/logout, `/users/me`, accept-privacy-policy, dạng role, key JWT | `/spec`, `api-and-interface-design`                                                   | `docs/specs/auth.md` đã được Backend xác nhận                                        |
| `src/api/client.ts`: Axios + chuẩn hóa ProblemDetails → AppError + refresh single-flight    | `/test` trước, `expo-data-fetching`                                                   | Test: 3 request 401 đồng thời → chỉ 1 lần gọi `/auth/refresh`; refresh fail → logout |
| Login (Zod), role guard VIU, Privacy Consent, Logout đầy đủ theo §8                         | `/build`, `expo-router`, `frontend-ui-engineering`                                    | Đủ TTS cho mọi nhánh; TalkBack đọc đúng                                              |
| Soát bảo mật auth                                                                           | agent `security-auditor`, `security-and-hardening`                                    | Không có token ngoài SecureStore; không log token                                    |
| **Prototype** YOLOv8n INT8 + ONNX Runtime + vision-camera frame processor                   | `source-driven-development`, `expo-module` (nếu cần plugin native), `expo-dev-client` | Đo được ms/frame trên máy mid-range                                                  |
| Quyết định fallback (ONNX / TFLite / server)                                                | `doubt-driven-development`, `documentation-and-adrs`                                  | `docs/adr/0001-on-device-inference.md` **trước khi hết sprint**                      |

### Sprint 3: Obstacle Detection

| Task                                                                                            | Skill                                | Done khi                                                                            |
| ----------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| Distance estimator (Near/Medium/Far theo tỉ lệ bbox)                                            | `/test`                              | Test ngưỡng; không bao giờ ra số mét                                                |
| Priority selector (danger → distance → confidence) + lọc Minimal/Full                           | `/test`                              | Test cả 2 mode                                                                      |
| Pipeline: frame skipping → inference → NMS → TtsService (DANGER, cooldownKey = class, maxAgeMs) | `/build`, `performance-optimization` | ≤ 500ms/cycle; TTS ≤ 1s                                                             |
| Navigation session start/end (offline tạo session local) + keep-awake                           | `expo-data-fetching`                 | End session gửi được tổng kết                                                       |
| `offlineQueue.ts` + ghi detection event (flush qua `/events/batch`, chia lô ~100)               | `/test`                              | Test flush theo thứ tự ưu tiên, xóa khi 2xx, bỏ 4xx vĩnh viễn, không drop emergency |
| Đo `inference_time_ms`, pin/giờ                                                                 | `observability-and-instrumentation`  | Có số benchmark ghi vào `docs/benchmarks.md`                                        |
| Review                                                                                          | `/review`, `/ponytail-review`        |                                                                                     |

### Sprint 4: Voice Commands

| Task                                                                              | Skill                                                         | Done khi                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------- |
| Chọn thư viện STT (expo-speech-recognition) + whisper.rn (tiny/base, tải runtime) | `source-driven-development`, `doubt-driven-development`       | ADR `0002-stt-engines.md`               |
| Intent matcher (giữ dấu)                                                          | `/test`                                                       | Test các cặp dễ nhầm "có/cô/cỏ"         |
| Confirmation flow 10s + chỉ nhận từ cố định                                       | `/test` (fake timers)                                         | Timeout → CANCELLED + TTS               |
| **Echo guard** (bỏ transcript khi `ttsService.isSpeaking()`)                      | `/test`, `doubt-driven-development`                           | Test: TTS đang đọc "tôi ổn" → không hủy |
| SpeechService: Google → Whisper fallback + TTS thông báo                          | `/build`                                                      | Offline vẫn chạy                        |
| Voice Listening Bottom Sheet                                                      | `expo-ui` (BottomSheet) hoặc Modal, `frontend-ui-engineering` | TalkBack không đọc đè                   |
| Voice logs vào offline queue                                                      | `expo-data-fetching`                                          |                                         |
| Chạy `/graphify` lần đầu                                                          | `/graphify`                                                   | Có bản đồ kiến trúc để review           |

### Sprint 5: Scene Understanding (online)

| Task                                                                                    | Skill                                                      | Done khi                            |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------- |
| Chốt contract OCR/QR/Face                                                               | `/spec`                                                    |                                     |
| OCR: chụp → nén (expo-image-manipulator) → upload multipart; LOW_CONFIDENCE → không đọc | `expo-data-fetching`, `/test` cho logic phân nhánh kết quả | "Đang đọc..." khi > 1.5s            |
| QR on-device + xử lý URL (hỏi xác nhận bằng giọng)                                      | `source-driven-development` (vision-camera code scanner)   | Chạy offline                        |
| Face recognition + **xóa ảnh trong `finally`** (BR-22)                                  | `/test`, agent `security-auditor`                          | Test: ảnh bị xóa cả khi request lỗi |
| Offline → TTS "cần kết nối mạng"                                                        |                                                            |                                     |

### Sprint 6: Location

| Task                                                                                                     | Skill                                                     | Done khi                                 |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------- |
| Chốt: GPS ngoài session (low-power); dùng `/locations/gps/batch`, `/locations/me`, `PUT /auth/fcm-token` | `/spec`, `interview-me` (với team)                        |                                          |
| Background location task (headless → SQLite → `POST /api/locations/gps` từng điểm, idempotent)           | `source-driven-development` (expo-location, task-manager) | Không phụ thuộc SignalR trong background |
| LocationHubClient: chỉ nhận `ArrivalNotification` (foreground, reconnect)                                | `api-and-interface-design`                                | Dedupe với FCM cùng sự kiện              |
| "Tôi đang ở đâu?" online + cache offline (BR-15)                                                         | `/test` cho nhánh cache                                   |                                          |
| ArrivalNotification → TTS + haptic                                                                       | `/build`                                                  |                                          |
| FCM token gửi trong `device.fcmToken` lúc login (Firebase cần rebuild dev client)                        | `expo-dev-client`, `source-driven-development`            | `google-services.json` qua EAS secrets   |

### Sprint 7: Emergency

`/ponytail lite`. Bắt buộc review 2 lớp.

| Task                                                                                  | Skill                                                              | Done khi                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| FallDetector: 2 tín hiệu (accelerometer + camera bất động)                            | `/test`, `doubt-driven-development`                                | Test: 1 tín hiệu đơn lẻ không bao giờ trigger |
| Countdown 15s (TTS + haptic mỗi giây), chạm bất kỳ đâu = hủy, "tôi ổn" qua echo guard | `/test` (fake timers), `frontend-ui-engineering`                   | Gọi dismiss trước khi server hết grace        |
| SOS manual/voice/gesture + confirmation 10s + gọi ACTION_CALL / Zalo                  | `source-driven-development`, `expo-module` nếu cần module gọi điện | Tự quay số, không dùng `tel:`                 |
| Offline fallback (gọi contact ưu tiên 1 từ cache)                                     | `/test`                                                            | Emergency không bao giờ bị drop khỏi queue    |
| BatteryMonitor < 10% → Minimal (báo 1 lần)                                            | `/test`                                                            |                                               |
| Review                                                                                | agent `code-reviewer` + `security-auditor` + `test-engineer`       | Coverage module emergency ≥ 70%               |

### Sprint 8: Settings, Hardening & Release

| Task                                                           | Skill                                                 | Done khi                                 |
| -------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------- |
| Settings (TTS prefs, mode, profile, đổi mật khẩu)              | `/build`, `expo-data-fetching`                        | Lưu → TTS xác nhận                       |
| TalkBack pass toàn app, xử lý mất quyền camera/GPS             | `frontend-ui-engineering`                             | Checklist §5 đạt 100%                    |
| Benchmark cuối (TTS ≤ 1s, OCR ≤ 3s P95, pin ≤ 20%/h)           | `performance-optimization`, `eas-observe` (tùy chọn)  | So với CONSTRAINTS.md                    |
| Dọn code                                                       | `/ponytail-audit`, `/ponytail-debt`, `/code-simplify` | Xử lý hoặc ghi nhận mọi `ponytail:` debt |
| User Guide + Limitations (fall detection chỉ trong session...) | `documentation-and-adrs`                              |                                          |
| Pre-launch go/no-go                                            | `/ship`                                               |                                          |
| Build production AAB                                           | `eas-app-stores`                                      | **Chỉ chạy khi user xác nhận**           |
| (Tùy chọn) OTA                                                 | `eas-update`                                          | Chỉ chạy khi user xác nhận               |

---

## 5. Việc cần chốt với Backend (chặn sprint)

Danh sách GAP đầy đủ (đối chiếu source backend 2026-09-27) nằm ở **CLAUDE.md mục 19**. Tóm tắt theo sprint:

| Chặn     | GAP                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Sprint 2 | ✅ GAP-1 đã xử lý; GAP-13 dạng lỗi (client đã xử lý cả hai)                                           |
| Sprint 3 | ✅ GAP-6, GAP-10 đã xử lý; GAP-14 giới hạn batch (client tự chia lô)                                  |
| Sprint 5 | **GAP-3** ai chạy OCR, **GAP-4** ai chạy nhận diện khuôn mặt (quyết định kiến trúc)                   |
| Sprint 6 | ✅ GAP-5, GAP-7, GAP-10 đã xử lý                                                                      |
| Sprint 7 | ✅ GAP-9, GAP-12 (Caregiver đánh dấu) đã xử lý; còn GAP-11 snapshot riêng, key độ nhạy fall detection |
| Release  | GAP-8 HTTPS                                                                                           |

Mỗi GAP → gửi team Backend (spec ngắn trong `docs/specs/` nếu cần), được bổ sung rồi mới `/build`.
