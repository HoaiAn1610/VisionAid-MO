# ADR 0002: Nhận dạng giọng nói — `expo-speech-recognition` (online) + `whisper.rn` (offline)

- **Trạng thái:** 🟡 Đề xuất (Proposed), 2026-10-01. Chuyển sang Chấp nhận sau khi đo trên máy thật (mục 6).
- **Ngày:** 2026-10-01
- **Liên quan:** CLAUDE.md §2 (Tech stack: STT online/offline), §9.5 (Voice Commands), §12 (danh sách lệnh), §13 (Offline); BR-14, BR-16.

## 1. Bối cảnh

Lệnh giọng nói (FE-09) phải: nhận tiếng Việt, **chạy được khi offline** (BR-16: Google STT lỗi hoặc mất mạng → tự chuyển Whisper + TTS báo), ≤ 2 s đầu-cuối khi online, không nhúng API key trong app. Danh sách lệnh nhỏ, cố định (khoảng 12 lệnh, CLAUDE.md §12) — đây là bài toán **câu lệnh ngắn**, không phải đọc chính tả dài.

Môi trường: Expo SDK 57, React Native 0.86 (New Architecture), Android 10+ (minSdk 29). Máy test Samsung Galaxy S20 FE, Android 13, có sẵn dịch vụ nhận dạng `com.google.android.tts` (mặc định) và `com.google.android.as` (nhận dạng ngay trên máy).

## 2. Các phương án

### 2.1 Online (Google Speech qua `SpeechRecognizer` của Android)

| Tiêu chí           | A. `expo-speech-recognition` 57.1                                                               | B. `@react-native-voice/voice` 3.2                  |
| ------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Bảo trì            | ✅ Bản theo từng Expo SDK (tag `sdk-56`, `latest` = 57.x), cập nhật 2026-09-16                  | ⚠️ Bản cuối 2026-01-31; CLAUDE.md đã ghi ít bảo trì |
| Tích hợp Expo      | ✅ Config plugin (quyền mic, `queries` cho gói Google)                                          | Cần tự sửa manifest                                 |
| Kết quả            | `results[]` có `transcript` + `confidence`, `maxAlternatives`, interim results, sự kiện lỗi rõ  | Có, ít tùy chọn hơn                                 |
| Câu lệnh ngắn      | Hỗ trợ `EXTRA_LANGUAGE_MODEL: "web_search"` (Google khuyên cho câu 1–2 từ), `contextualStrings` | —                                                   |
| Nhận dạng trên máy | ✅ `requiresOnDeviceRecognition` (Android 13+, cần tải gói ngôn ngữ)                            | ❌                                                  |
| API key            | Không cần (dùng dịch vụ của hệ điều hành)                                                       | Không cần                                           |

### 2.2 Offline

| Tiêu chí                | C. `whisper.rn` 0.7 (whisper.cpp)                                                                                                                                              | D. Google on-device (cùng thư viện A, `requiresOnDeviceRecognition`)               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Android hỗ trợ          | ✅ Mọi bản từ Android 10                                                                                                                                                       | ❌ Chỉ Android 13+, và chỉ khi máy có `com.google.android.as` + đã tải gói `vi-VN` |
| Có tiếng Việt chắc chắn | ✅ Model multilingual                                                                                                                                                          | ⚠️ Chưa xác minh gói `vi-VN` có cho on-device (phụ thuộc Google, từng dòng máy)    |
| Dung lượng              | Model tải runtime: tiny-q8_0 43.5 MB, tiny-q5_1 32.2 MB, base-q8_0 81.8 MB, base-q5_1 59.7 MB                                                                                  | 0 MB trong app (gói do hệ điều hành quản lý)                                       |
| New Architecture        | ✅ TurboModule (`codegenConfig: RNWhisperSpec`), JSI                                                                                                                           | ✅                                                                                 |
| Thu âm                  | Cần PCM 16 kHz mono → thêm `@fugood/react-native-audio-pcm-stream` (chính whisper.rn dùng trong adapter realtime). `expo-audio` trên Android chỉ ghi AAC/3GP, không ra PCM/WAV | Hệ điều hành tự thu                                                                |
| Độ chính xác tiếng Việt | tiny/base kém hơn Google rõ rệt; bù bằng `prompt` chứa danh sách lệnh + intent matcher chỉ cần khớp từ khóa                                                                    | Nhiều khả năng tốt hơn Whisper tiny/base                                           |
| Đúng tài liệu dự án     | ✅ BR-16 ghi rõ Whisper                                                                                                                                                        | Lệch BR-16                                                                         |

Model Whisper `small` (khoảng 190 MB bản q5_1, 470 MB bản gốc) như docx ghi là quá nặng cho máy 4 GB RAM → loại.

## 3. Quyết định

- **Online:** chọn **A — `expo-speech-recognition`**, `lang: "vi-VN"`, `maxAlternatives: 3`, `EXTRA_LANGUAGE_MODEL: "web_search"`, `contextualStrings` = các cụm lệnh trong `voiceCommands.ts`.
- **Offline:** chọn **C — `whisper.rn`** (đúng BR-16, chạy trên mọi Android 10+), thu âm bằng `@fugood/react-native-audio-pcm-stream`, gọi `transcribeData()` với PCM 16 kHz mono, `language: "vi"` và `prompt` chứa danh sách lệnh. Model mặc định **`ggml-tiny-q8_0.bin` (43.5 MB)**, nâng lên `base-q5_1` nếu đo thấy tiny nhận sai nhiều (mục 6).
- **D (Google on-device)** không làm ở Sprint 4; chỉ ghi nhận làm phương án nâng cấp nếu Whisper không đạt độ chính xác (mục 5).

Luồng (`src/services/speech/SpeechService.ts`):

```
Nút / cử chỉ kích hoạt → haptic + "bíp"
→ online (NetworkMonitor) ? expo-speech-recognition : Whisper
→ Google lỗi `network` / `service-not-allowed` / `language-not-supported` → chuyển Whisper
   + TTS "Đang dùng nhận dạng giọng nói ngoại tuyến" (BR-16)
→ transcript + confidence → echo guard (bỏ nếu ttsService.isSpeaking()) → intent matcher
→ log voice command (recognitionEngine: "GoogleSpeech" | "Whisper") vào offline queue
```

## 4. Hệ quả

- **Thêm 3 gói native:** `expo-speech-recognition`, `whisper.rn`, `@fugood/react-native-audio-pcm-stream` → phải build lại dev client (`expo prebuild` / `gradlew assembleDebug`). Gói PCM stream **không khai báo codegen** (module kiểu cũ) → chạy qua lớp interop của New Architecture; phải thử trên máy ngay khi cài (rủi ro chính của ADR này).
- **Model Whisper tải lần đầu khi có Wi-Fi** (không bundle vào APK, đúng CLAUDE.md §2), lưu trong `documentDirectory`, kiểm SHA-256 sau khi tải, tải lại nếu hỏng. Chưa tải xong mà offline → TTS báo lệnh giọng nói cần mạng lần đầu; nút chạm vẫn dùng được.
- **Quyền:** `RECORD_AUDIO` (đã có trong §14), config plugin của `expo-speech-recognition` thêm `queries` cho gói Google.
- **Âm "bíp" của Android 13+:** `SpeechRecognizer` tự phát; giữ lại vì CLAUDE.md §9.5 cần tiếng bíp báo bắt đầu nghe.
- **Echo guard:** cả hai engine đều thu cả tiếng loa → bắt buộc bỏ transcript khi TTS đang phát (§9.7, §16.20), và chỉ mở mic sau khi TTS đọc xong câu nhắc.
- **`recognitionEngine`** gửi lên backend là chuỗi tự do: thống nhất `"GoogleSpeech"` / `"Whisper"` (khớp `RecognitionEngine` trong `enums.ts`).
- **iOS:** cả hai thư viện đều hỗ trợ iOS; không chủ động làm hỏng iOS (EX-07).

## 5. Phương án nâng cấp (chưa làm)

Nếu Whisper tiny/base nhận sai nhiều lệnh tiếng Việt: thêm **D** làm bậc offline ưu tiên trên máy Android 13+ đã có gói `vi-VN` (`getSupportedLocales()`, `androidTriggerOfflineModelDownload()`), Whisper chỉ còn cho Android 10–12. Cần nhóm đồng ý vì lệch BR-16.

## 6. Cần đo trước khi chấp nhận (Sprint 4, task SpeechService)

Trên Samsung Galaxy S20 FE (và máy tầm trung nếu có), với 12 lệnh ở CLAUDE.md §12, mỗi lệnh 5 lần:

| Chỉ số                                                      | Mục tiêu                  |
| ----------------------------------------------------------- | ------------------------- |
| Google online: thời gian nói xong → có intent               | ≤ 2 s (§9.5)              |
| Whisper tiny-q8_0: tỉ lệ nhận đúng intent                   | ≥ 90% (nếu không: base)   |
| Whisper: RTF = processing_time / audio_duration             | < 1                       |
| Gói PCM stream chạy trên New Architecture                   | Thu được PCM, không crash |
| `getSupportedLocales()` trên máy có `vi-VN` on-device không | Ghi nhận cho mục 5        |
