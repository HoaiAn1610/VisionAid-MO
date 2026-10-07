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

**Trạng thái (2026-10-01): ✅ Xong (còn việc hoãn).** Xong: distance estimator, priority selector, pipeline (GPU → CPU, letterbox cả khung), xác nhận qua 2 frame, báo lại khi vật tiến gần trong cooldown, báo tạm dừng khi app chạy nền, navigation session offline-first, `offlineQueue.ts` (sender của emergency/GPS/voice/QR gắn vào ở Sprint 4–7), review, benchmark trên S20 FE (`docs/benchmarks.md`: TTS khoảng 180 ms, pin khoảng 19–20%/giờ ở 3 fps), đã bỏ màn Detector Lab.

**Hoãn (làm trước UAT ở Sprint 8):** hiệu chỉnh ngưỡng `DISTANCE_*` ngoài trời (hiện là quy đổi tỉ lệ sau khi đổi sang letterbox, mới thử trong nhà); đo lại pin trên máy tầm trung nếu có.

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

**Trạng thái (2026-10-02):** ✅ Task 1–5: ADR 0002 **Accepted** (Google online + Google nhận dạng trên máy; Whisper và Vosk đã đo và loại — lệch BR-16, nhóm cần báo giảng viên), intent matcher, xác nhận 10 s, echo guard, SpeechService. ✅ Task 6: Voice Listening Bottom Sheet trên Home (Modal, thực thi lệnh có sẵn, xác nhận "đồng ý"), đã gỡ màn thử. ✅ Task 7: voice log qua hàng đợi offline (`POST /api/voice-commands`; tài khoản test đang bị 402 license nên log được giữ trong hàng đợi, chờ xác nhận server nhận payload khi có license). Còn: chạy `/graphify` cho repo mobile, review Sprint 4.

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

**Trạng thái (2026-10-02):** ✅ QR on-device (ML Kit qua VisionCamera code scanner), log `POST /api/ocr/qr-scans` qua hàng đợi offline. ✅ Đọc chữ (`app/(main)/read-text.tsx`): VietOCR trên server, offline / server lỗi / không ra chữ → ML Kit Text Recognition trên máy, log qua hàng đợi `ocr`. ✅ Nhận diện người quen (`app/(main)/face.tsx`): `POST /face-registry/identify`, ảnh xóa trong `finally`. Lệnh giọng nói "đọc chữ", "đây là ai" đã nối. ⏳ Chưa thử trên máy; chờ backend sửa GAP-18, GAP-20.

**Kiến trúc đã chốt (backend `a1e4df9`):** OCR **lai** (online: server chạy VietOCR; offline: ML Kit trên máy). Nhận diện khuôn mặt **chạy trên server** (`POST /api/face-registry/identify`, FaceNet vggface2 + pgvector), **không có bản offline**. Chi tiết contract và lỗ hổng: CLAUDE.md mục 9.3, 9.4, 19 (GAP-3, GAP-4, GAP-18..22).

| Task                                                                                                                                                                                                                                              | Skill                                              | Done khi                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------- |
| OCR online: chụp → nén JPEG (cạnh dài ~1600px, < 1MB) → `POST /api/ocr/requests` multipart `Image`, `TriggerMethod`, `ResultStatus=Failed`, `OcrEngine=pending` (bắt buộc gửi, server ghi đè khi VietOCR chạy, GAP-19) → đọc `data.processedText` | `expo-data-fetching`, `/test` cho logic phân nhánh | "Đang đọc..." khi > 1.5s; timeout client ~8s |
| Phân nhánh kết quả OCR: `ocrEngine == "vietocr"` + có text → đọc; `vietocr` + rỗng → "Không đọc rõ, chụp lại" (BR-24); khác `vietocr` (server OCR lỗi) / timeout / 5xx → fallback ML Kit                                                          | `/test`                                            | Test đủ 4 nhánh                              |
| OCR offline: ML Kit Text Recognition (Latin, on-device, cần prebuild) → đọc text → log `/api/ocr/requests` với `ProcessedText`, `OcrEngine=mlkit`, **không gửi ảnh**, qua hàng đợi offline                                                        | `source-driven-development`                        | Chạy khi tắt mạng                            |
| Face: chụp → `POST /api/face-registry/identify` multipart field **`photo`** → TTS từ `recognized` + `matchedPersonName` + `relationship` (chuỗi trong `strings.vi.ts`, không đọc `ttsText` của server)                                            | `/test`                                            | TTS ≤ 3s P95                                 |
| Face: **xóa ảnh trong `finally`** (BR-22); **không** gọi `/recognition-logs` (server đã tự log)                                                                                                                                                   | `/test`, agent `security-auditor`                  | Test: ảnh bị xóa cả khi request lỗi          |
| Face offline / 422 (FaceNet lỗi) → TTS "cần kết nối mạng" / "tạm thời không khả dụng"                                                                                                                                                             |                                                    |                                              |
| Cập nhật theo backend `b878270`: OCR dùng `serverOcrAvailable` + ngưỡng `confidenceScore` (BR-24, GAP-25); Face xử lý `lowConfidence` và 422 "không thấy khuôn mặt" (GAP-26); hàng đợi coi 409 là đã có trên server                               | `/test`                                            | Test các nhánh mới                           |
| Thử trên máy với ảnh thật (biển hiệu nhiều dòng, khuôn mặt chụp xa) sau khi backend deploy `b878270`                                                                                                                                              | `/run`                                             | Có số liệu gửi backend                       |

Không làm ở mobile: upload ảnh khuôn mặt (việc của Caregiver trên web; mục 2 trong ghi chú backend là cho web). Không cần tải `/face-registry/persons/me` nữa.

### Sprint 6: Location

**Trạng thái (2026-10-06):** ✅ "Tôi đang ở đâu?" (đã thử trên máy: đọc đúng địa chỉ, bỏ mã bưu chính/"Việt Nam"; offline đọc cache kèm giờ, BR-15). ✅ GPS nền qua foreground service: dày khi dẫn đường (10 s / 10 m), thưa ngoài phiên (2 phút / 100 m, đề xuất chờ nhóm chốt), SQLite → `/locations/gps/batch`; cần `RECEIVE_BOOT_COMPLETED` (máy đã cài bản cũ phải gỡ cài lại). ✅ SignalR `ArrivalNotification` → TTS + rung, chống đọc lặp với FCM; chưa thử với sự kiện thật. ✅ FCM (code, commit `07e8ab1`): token gửi lúc đăng nhập + `PUT /auth/fcm-token` khi đổi, nhận `ArrivalNotification` cả khi chạy nền. ⏳ Chưa build được bản dev: `google-services.json` thiếu `vn.visionaid.mobile.dev`; payload FCM thiếu field (GAP-27).

| Task                                                                                                     | Skill                                                     | Done khi                                 |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------- |
| Chốt: GPS ngoài session (low-power); dùng `/locations/gps/batch`, `/locations/me`, `PUT /auth/fcm-token` | `/spec`, `interview-me` (với team)                        |                                          |
| Background location task (headless → SQLite → `POST /api/locations/gps` từng điểm, idempotent)           | `source-driven-development` (expo-location, task-manager) | Không phụ thuộc SignalR trong background |
| LocationHubClient: chỉ nhận `ArrivalNotification` (foreground, reconnect)                                | `api-and-interface-design`                                | Dedupe với FCM cùng sự kiện              |
| "Tôi đang ở đâu?" online + cache offline (BR-15)                                                         | `/test` cho nhánh cache                                   |                                          |
| ArrivalNotification → TTS + haptic                                                                       | `/build`                                                  |                                          |
| FCM token gửi trong `device.fcmToken` lúc login (Firebase cần rebuild dev client)                        | `expo-dev-client`, `source-driven-development`            | `google-services.json` qua EAS secrets   |

### Sprint 7: Emergency

**Trạng thái (2026-10-07, nhánh `feature/sprint7-emergency`):** ✅ SOS thủ công / giọng nói (xác nhận 10 s; gọi người liên hệ **chạy song song** với gửi event; lỗi mạng / server → hàng đợi gắn `owner_id`, tự gửi lại). ✅ Gọi qua `TelecomManager.placeCall` (module `modules/phone-call`) — không còn hộp "chọn ứng dụng" khi máy có Zalo; 112/113/114/115 → trình quay số mặc định; chỉ có Zalo → deep link (chỉ `zalo.me` / `zalo://`). ✅ Quyền gọi điện xin trước (bắt đầu dẫn đường, mở màn khẩn cấp). ✅ Deep link không kích hoạt được SOS (`app/+native-intent.tsx` + cờ xác nhận trong bộ nhớ). ✅ Danh bạ khẩn cấp cache SQLite. ✅ License `NONE` chặn dẫn đường, `TRIAL` báo số ngày. ✅ Pin < 10% → Minimal một lần. ✅ FallDetector 2 tín hiệu (rơi tự do + va chạm, rồi camera đứng yên 5 s) + đếm ngược 15 s (rung mỗi giây, chỉ đọc số ở 10 và 5; chạm / "tôi ổn" / phím âm lượng = hủy; `detectedAt` = lúc đủ 2 tín hiệu; GPS treo vẫn gửi event). ✅ Review 2 lớp + lần rà thứ hai, sửa hết lỗi Critical/High/Medium. ✅ **Thử trên máy (Galaxy S20 FE, 2026-10-06):** tải danh bạ, xin quyền trước, màn khẩn cấp không tự gửi, xác nhận → gọi trong ~4 s; server 500/504 tạm thời → hàng đợi giữ và tự gửi khi server ổn. Thử trên máy cũng tìm ra: hộp chọn app (Zalo) và SignalR 401 sau khi token hết hạn — đã sửa. ✅ **Thử té ngã trên máy (2026-10-07, sau khi cập nhật SDK 57 patch):** camera + YOLO vẫn cảnh báo vật cản; mọi lần thả lên gối đều phát hiện; nói "tôi ổn" hủy được; để hết 15 s → app nhận `WebRtcIncomingCall` lặp mỗi 5 s — **do lỗi backend GAP-35** (dispatcher truy vấn sai cột, rollback sau khi đã gửi SignalR): cảnh báo té ngã nhiều khả năng **chưa bao giờ chuyển `Sent`**, Caregiver không nhận FCM. Phần mobile đúng. BE đã sửa ở `f3e85f0` (07/10) — cần thử lại trên máy. TalkBack: tiêu điểm nhảy lên màn đỏ, TalkBack không đọc chồng (chỉ TTS của app đọc, đúng §5.7). ⏳ Chưa thử: hủy bằng chạm hai lần khi TalkBack bật, phím âm lượng. ❌ **Ngoài phạm vi:** SOS bằng cử chỉ (`Gesture`) — ghi ở CLAUDE.md §20. Tùy chọn nếu còn thời gian: snapshot té ngã (GAP-11), test cho `useSos` / `fallAlertService` / `BatteryMonitor` (coverage module emergency chưa đạt 70%). Hoãn sang Sprint 9: đánh rơi điện thoại có thể báo té ngã (lọc khung hình đen/đồng màu + hiệu chỉnh khi đeo chest strap). Backend: GAP-31, GAP-32.

`/ponytail lite`. Bắt buộc review 2 lớp.

| Task                                                                                                                                                       | Skill                                                              | Done khi                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| FallDetector: 2 tín hiệu (accelerometer + camera bất động)                                                                                                 | `/test`, `doubt-driven-development`                                | Test: 1 tín hiệu đơn lẻ không bao giờ trigger |
| Countdown 15s (TTS + haptic mỗi giây), chạm bất kỳ đâu = hủy, "tôi ổn" qua echo guard                                                                      | `/test` (fake timers), `frontend-ui-engineering`                   | Gọi dismiss trước khi server hết grace        |
| SOS manual/voice (gesture: ngoài phạm vi) + confirmation 10s + gọi `TelecomManager.placeCall` / Zalo                                                       | `source-driven-development`, `expo-module` nếu cần module gọi điện | Tự quay số, không dùng `tel:`                 |
| Số khẩn cấp 112/113/114/115 (Standalone Mode): `ACTION_CALL` bị Android chặn → `ACTION_DIAL` + TTS hướng dẫn chạm nút gọi; gọi trước contact thường nếu có | `/test`                                                            | Test chọn contact + cách gọi                  |
| License (Update Report §3.4): `NONE` → từ chối bắt đầu dẫn đường + TTS hướng dẫn; `TRIAL` → báo số ngày còn lại; SOS không bao giờ bị chặn                 | `/test`                                                            | Test cả 5 trạng thái                          |
| Offline fallback (gọi contact ưu tiên 1 từ cache)                                                                                                          | `/test`                                                            | Emergency không bao giờ bị drop khỏi queue    |
| BatteryMonitor < 10% → Minimal (báo 1 lần)                                                                                                                 | `/test`                                                            |                                               |
| Review                                                                                                                                                     | agent `code-reviewer` + `security-auditor` + `test-engineer`       | Coverage module emergency ≥ 70%               |

### Sprint 8: Hybrid AI Navigation + WebRTC (Update Report 28/9/2026)

**Quyết định đã chốt khi đối chiếu báo cáo (2026-10-06):** app mobile chỉ cho VIU (Caregiver đăng ký / thanh toán / nhập license code trên web); `position` 5 dải đều nhau; YOLO giữ float16 + GPU (ADR 0001) — SRS/slide sửa số "INT8, 200–500 ms".

Cả hai đã được Hội đồng/Mentor chốt vào phạm vi. Câu hỏi contract còn mở: GAP-23, GAP-24 (CLAUDE.md §19) — gửi backend trước khi bắt đầu.

| Task                                                                                                                                                     | Skill                                                 | Done khi                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| Tính `position` 5 dải từ bounding box; chỉ NEAR cảnh báo ngay trên máy                                                                                   | `/test`                                               | Test ranh giới các dải                                   |
| Gửi MEDIUM/FAR lên `POST /api/navigation/guidance` khi tập vật thay đổi (có giới hạn tần suất), đọc `ttsText`; chờ tối đa `navigation_near_threshold_ms` | `/test`, `api-and-interface-design`                   | Không gửi mỗi frame; quá hạn → fallback                  |
| Rule-Based + template câu trên máy (chép từ `RuleBasedDecisionEngine.cs` / `TtsTemplateHelper.cs`) cho offline, phiên chưa đồng bộ, lỗi, chậm            | `/test`                                               | Cùng input → cùng `action` + câu với server              |
| Ưu tiên TTS: cảnh báo NEAR (DANGER) luôn đè hướng dẫn rẽ/tránh; cooldown riêng cho hướng dẫn                                                             | `/test`                                               |                                                          |
| ADR 0003: thư viện WebRTC (`react-native-webrtc` + config plugin) và cách nhường camera với VisionCamera                                                 | `documentation-and-adrs`, `source-driven-development` | Thử trên máy: gọi được, camera trả lại YOLO              |
| Nhận cuộc gọi: `WebRtcIncomingCall` → TTS "{tên} đang gọi" + rung; `SOS_AUTO` tự nhận; nhận/kết thúc bằng phím âm lượng, nút lớn, giọng nói              | `/test`, `frontend-ui-engineering`                    | Không cần nhìn màn hình                                  |
| Gọi đi: lệnh "gọi người chăm sóc" → `POST /api/webrtc/sessions` (`VIU_VOICE_COMMAND`); lệnh "kết thúc cuộc gọi"                                          | `/test`                                               |                                                          |
| Signaling qua hub (`RelayOffer/Answer/IceCandidate`), ICE từ `/api/webrtc/ice-servers/public`, gửi video camera sau + audio, chỉ nghe Caregiver          | `source-driven-development`                           | Caregiver thấy video trên dashboard                      |
| Review                                                                                                                                                   | agent `code-reviewer` + `security-auditor`            | Video chỉ truyền trong cuộc gọi, privacy policy cập nhật |

### Sprint 9: Settings, Hardening & Release

| Task                                                                                                                                                            | Skill                                                 | Done khi                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| Settings (TTS prefs, mode, profile, đổi mật khẩu)                                                                                                               | `/build`, `expo-data-fetching`                        | Lưu → TTS xác nhận                                        |
| TalkBack pass toàn app, xử lý mất quyền camera/GPS                                                                                                              | `frontend-ui-engineering`                             | Checklist §5 đạt 100%                                     |
| Benchmark cuối (TTS ≤ 1s, OCR ≤ 3s P95, pin ≤ 20%/h)                                                                                                            | `performance-optimization`, `eas-observe` (tùy chọn)  | So với CONSTRAINTS.md                                     |
| Hiệu chỉnh ngưỡng khoảng cách ngoài trời (hoãn từ Sprint 3)                                                                                                     | `/test`                                               | Đứng 1–2 m / 3–5 m / > 8 m đọc đúng gần / phía trước / xa |
| Dọn code                                                                                                                                                        | `/ponytail-audit`, `/ponytail-debt`, `/code-simplify` | Xử lý hoặc ghi nhận mọi `ponytail:` debt                  |
| User Guide + Limitations (CLAUDE.md §20: chest strap bắt buộc, điểm mù camera, dùng kèm gậy trắng, ánh sáng yếu, fall detection chỉ trong session, số khẩn cấp) | `documentation-and-adrs`                              |                                                           |
| Hiệu chỉnh ngưỡng Near/Medium/Far + dải `position` khi đeo chest strap                                                                                          | `/test`                                               | Đo thực tế ở tư thế đeo ngực                              |
| Pre-launch go/no-go                                                                                                                                             | `/ship`                                               |                                                           |
| Build production AAB                                                                                                                                            | `eas-app-stores`                                      | **Chỉ chạy khi user xác nhận**                            |
| (Tùy chọn) OTA                                                                                                                                                  | `eas-update`                                          | Chỉ chạy khi user xác nhận                                |

---

## 5. Việc cần chốt với Backend (chặn sprint)

Danh sách GAP đầy đủ (đối chiếu source backend 2026-09-27) nằm ở **CLAUDE.md mục 19**. Tóm tắt theo sprint:

| Chặn     | GAP                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 2 | ✅ GAP-1 đã xử lý; GAP-13 dạng lỗi (client đã xử lý cả hai)                                                                                       |
| Sprint 3 | ✅ GAP-6, GAP-10 đã xử lý; GAP-14 giới hạn batch (client tự chia lô)                                                                              |
| Sprint 5 | ✅ GAP-3/4, GAP-18–22 đã xử lý (`b878270`); còn GAP-25 ngưỡng OCR + `LowConfidence`, GAP-26 mã lỗi "không thấy mặt"                               |
| Sprint 6 | ✅ GAP-5, GAP-7, GAP-10 đã xử lý; ✅ GAP-27 payload FCM data-only (`2fe9c2c`); còn GAP-28 seed gói license theo `Code` (thấp)                     |
| Sprint 7 | ✅ GAP-9, 11, 12, 31, 32, 35 đã xử lý (`f3e85f0`); còn GAP-38 (nhánh trùng không lọc VIU, lỗi WebRTC làm SOS trả 500), key độ nhạy fall detection |
| Sprint 8 | ✅ GAP-24, 29, 30, 33, 34, 36 đã xử lý; còn GAP-23 (35/80 class có tên tiếng Việt, tần suất, `sessionId` offline)                                 |
| Release  | ~~GAP-8 HTTPS~~ (đã có `https://api.visionaid.net`)                                                                                               |

Mỗi GAP → gửi team Backend (spec ngắn trong `docs/specs/` nếu cần), được bổ sung rồi mới `/build`.
