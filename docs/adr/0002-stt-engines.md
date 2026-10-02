# ADR 0002: Nhận dạng giọng nói — Google online + Google nhận dạng trên máy (`expo-speech-recognition`)

- **Trạng thái:** ✅ Chấp nhận (Accepted), 2026-10-02, sau khi đo 4 engine trên Samsung Galaxy S20 FE (mục 5).
- **Ngày:** 2026-10-01 (đề xuất), 2026-10-02 (chấp nhận)
- **Liên quan:** CLAUDE.md §2 (Tech stack), §5.6 (mọi tính năng dùng được bằng một cử chỉ chạm), §9.5 (Voice Commands), §12, §13; BR-14, **BR-16 (lệch — xem mục 4)**.

## 1. Bối cảnh

Lệnh giọng nói (FE-09) phải nhận tiếng Việt, **chạy được khi offline** (BR-16 ghi: Google STT lỗi / mất mạng → chuyển Whisper + TTS báo), ≤ 2 s khi online, không nhúng API key. Danh sách lệnh nhỏ, cố định (khoảng 12 lệnh, §12) — bài toán **câu lệnh ngắn**.

Môi trường: Expo SDK 57, React Native 0.86 (New Architecture), Android 10+ (minSdk 29). Máy đo: Samsung Galaxy S20 FE (SM-G780G), Android 13, có `com.google.android.tts` (mặc định) và `com.google.android.as` (nhận dạng trên máy, đã có gói `vi-VN`).

## 2. Các phương án đã thử trên máy thật

| Engine                                                                              | Cần mạng | Chạy trên                                          | Kích thước thêm vào app                   |
| ----------------------------------------------------------------------------------- | -------- | -------------------------------------------------- | ----------------------------------------- |
| A. Google online (`expo-speech-recognition` 57.1)                                   | Có       | Máy có dịch vụ Google                              | 0                                         |
| B. Google nhận dạng trên máy (cùng thư viện, `requiresOnDeviceRecognition`)         | Không    | Android 13+ có `com.google.android.as` + gói vi-VN | 0 (gói do hệ điều hành quản lý)           |
| C. Whisper `tiny-q8_0` (`whisper.rn` 0.7 + `@fugood/react-native-audio-pcm-stream`) | Không    | Mọi Android 10+                                    | Model 43.5 MB tải lần đầu                 |
| D. Vosk `small-vn-0.4` chế độ grammar (`react-native-vosk` 2.1)                     | Không    | Mọi Android 10+                                    | Model 32 MB (51 MB giải nén) đóng vào APK |

`@react-native-voice/voice` bị loại từ đầu (bản cuối 2026-01-31, ít bảo trì).

## 3. Quyết định

- **Online:** A — `lang: "vi-VN"`, `maxAlternatives: 3`, `EXTRA_LANGUAGE_MODEL: "web_search"` (Google khuyên cho câu 1–2 từ), `contextualStrings` = cụm lệnh trong `voiceCommands.ts`.
- **Offline (và khi Google online lỗi `network` / `service-not-allowed` / `language-not-supported` …):** B — cùng thư viện với `requiresOnDeviceRecognition: true`, TTS "Đang dùng nhận dạng giọng nói ngoại tuyến" (báo một lần cho tới khi online chạy lại).
- **Máy không có B** (Android 10–12, máy không có dịch vụ Google, chưa có gói vi-VN): khi offline TTS hướng dẫn dùng **nút chạm** — §5.6 vốn yêu cầu mọi tính năng cốt lõi đều dùng được bằng một cử chỉ chạm.
- **Gói vi-VN:** khi đăng nhập và mỗi lần chuyển sang Wi-Fi, app kiểm tra `getSupportedLocales()`; thiếu thì gọi `androidTriggerOfflineModelDownload()` **chỉ trên Android 14+** (tải ngầm). Android 13 hệ thống mở hộp thoại mà người khiếm thị không thao tác được → không tự gọi.
- **Loại C và D** (mục 5).

```
Nút / cử chỉ → chờ TTS im → echo guard đánh dấu bắt đầu nghe
→ online ? Google online : (máy có B ? Google trên máy : TTS "dùng nút" → dừng)
→ Google online lỗi dịch vụ → Google trên máy (+ TTS báo ngoại tuyến)
→ transcript (+ confidence) → bỏ nếu trùng lúc TTS phát → intent matcher
→ log voice command (recognitionEngine: "GoogleSpeech" | "GoogleOnDevice")
```

Code: `src/services/speech/{engines,SpeechService,onDeviceSpeech,echoGuard}.ts`.

## 4. Hệ quả

- **Lệch BR-16:** tài liệu ghi Whisper là engine offline. Whisper (C) đo được 0/6 trên máy thật → **nhóm cần báo giảng viên và cập nhật tài liệu (SRS / Business Rules)**: engine offline là "nhận dạng giọng nói trên máy của hệ điều hành (Google)", fallback cuối là nút chạm.
- **Phủ thiết bị:** offline bằng giọng nói chỉ có trên Android 13+ có dịch vụ Google + gói vi-VN. Máy khác vẫn dùng giọng nói khi có mạng, và luôn dùng được nút chạm. Ghi vào User Guide / Limitations.
- **Chỉ 1 gói native** (`expo-speech-recognition`), không model nào trong APK, không tải model riêng.
- **`confidence`:** Google online trả 0–1; Google trên máy trả `0` (không có) → intent matcher coi `≤ 0` là "không biết", không dùng để loại kết quả.
- **Echo guard bắt buộc** (§9.7, §16.20): mic chỉ mở khi TTS đã im; kết quả trùng lúc TTS phát bị bỏ.
- **`recognitionEngine`** gửi backend (chuỗi tự do): `"GoogleSpeech"` / `"GoogleOnDevice"` — cập nhật `RecognitionEngine` trong `enums.ts`.
- **Nâng cấp khi cần:** nếu lúc UAT có máy Android 10–12 cần lệnh giọng nói offline, cân nhắc thêm Vosk (D) làm tầng cuối (đã có số đo ở mục 5).

## 5. Kết quả đo (Samsung Galaxy S20 FE, Android 13, 2026-10-02)

Mỗi lệnh nói một lần qua màn "Thử lệnh giọng nói" (bản dev). "Thời gian" tính từ lúc bấm nút tới khi có kết quả — gồm tiếng bíp và lúc đang nói.

| Engine                  | Nhận đúng (lần nói đầu)                                    | Thời gian    | Ghi chú                                                                                                  |
| ----------------------- | ---------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| **A. Google online**    | **12/12**                                                  | 1.7 – 3.6 s  | confidence 0.76 – 0.95                                                                                   |
| **B. Google trên máy**  | **6/6** (bắt đầu, dừng lại ×2, quét mã, đây là ai, tôi ổn) | khoảng 2.8 s | Lượt đầu 7.5 s (dịch vụ khởi động). confidence = 0                                                       |
| C. Whisper tiny-q8_0    | 0/6                                                        | 9 – 13 s     | Rỗng, hoặc "ảo giác" lặp ("bây giờ, bây giờ…"); có prompt thì bịa ra chính lệnh trong prompt             |
| D. Vosk small (grammar) | khoảng 7/12; nói lại được 11/12, "đây là ai" sai cả 4 lần  | 2.3 – 3.1 s  | Grammar ghép từng từ → ra cụm vô nghĩa ("giản chữ"); nhầm dấu thanh ("đây" → "đầy"). Không bịa lệnh khác |

Model Whisper `base` không thử: các model Whisper nhỏ sai nhiều với tiếng Việt và vẫn có lỗi lặp; `small` trở lên quá nặng cho máy 4 GB RAM. Model Vosk lớn không hỗ trợ grammar.
