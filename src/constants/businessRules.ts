// Giá trị mặc định, khớp VisionAid-BE/src/Shared/Common/BusinessRules.cs. Key nào cần ghi đè lúc chạy thì
// đọc qua `configNumber`/`configBool` (services/config/runtimeConfig, tải từ /system-configs/public).
export const BusinessRules = {
  // AI thresholds
  YOLO_DEFAULT_CONFIDENCE: 0.5, // yolo_confidence_threshold
  FACENET_DEFAULT_SIMILARITY: 0.75, // facenet_similarity_threshold (so sánh STRICT >)
  YOLO_MAX_INFERENCE_MS: 500,
  NAVIGATION_NEAR_THRESHOLD_MS: 500, // navigation_near_threshold_ms — timeout gọi /navigation/guidance
  // Ước lượng khoảng cách từ box chuẩn hóa 0–1 theo CẢ khung dọc 9:16 (BR-11, LI-01).
  // Quy đổi ×0.56 từ ngưỡng cũ đo trên ô vuông giữa (0.2 / 0.06 / 0.7) — hiệu chỉnh khi thử ngoài đường.
  DISTANCE_NEAR_AREA: 0.11, // box chiếm ≥ 11% khung hình
  DISTANCE_MEDIUM_AREA: 0.035,
  DISTANCE_NEAR_HEIGHT: 0.4, // vật cao (người, cột) chiếm ≥ 40% chiều cao khung → đang ở sát

  // TTS
  TTS_COOLDOWN_SECONDS: 3, // tts_cooldown_seconds — per object class
  TTS_MIN_SPEED: 0.5,
  TTS_MAX_SPEED: 2.0,
  TTS_SPEED_STEP: 0.25,
  TTS_MIN_VOLUME: 0.0,
  TTS_MAX_VOLUME: 1.0,
  TTS_MAX_LATENCY_MS: 1000,

  // Emergency
  FALL_GRACE_PERIOD_SECONDS: 15, // fall_grace_period_seconds
  DANGEROUS_COMMAND_CONFIRM_TIMEOUT_SECONDS: 10,
  // Phát hiện té ngã (BR-26). ponytail: ngưỡng ước lượng theo tài liệu fall detection phổ biến,
  // chưa đo trên người thật đeo chest strap — hiệu chỉnh ở Sprint 9; backend chưa có config key (TBC).
  FALL_FREE_FALL_G: 0.4, // gia tốc tổng < 0.4 g = đang rơi tự do
  FALL_IMPACT_G: 2.5, // va chạm > 2.5 g trong 1 s sau khi rơi
  FALL_CAMERA_STILL_SECONDS: 5, // khung hình gần như không đổi liên tục sau va chạm
  FALL_CAMERA_STILL_DIFF: 0.03, // chênh lệch độ sáng trung bình lưới 8×8 (0–1)

  // Battery
  LOW_BATTERY_THRESHOLD_PERCENT: 10,

  // License — khớp BusinessRules.LicenseGracePeriodDays (LicenseValidationMiddleware)
  LICENSE_GRACE_PERIOD_DAYS: 3, // hết hạn ≤ 3 ngày vẫn dùng được, kèm header X-License-Warning

  // Voice commands (chỉ phía mobile, không có trong BusinessRules.cs) — hiệu chỉnh khi đo STT thật
  VOICE_MIN_CONFIDENCE: 0.5, // dưới ngưỡng → "Tôi chưa hiểu, vui lòng nói lại" (§5.8)

  // Performance targets
  VOICE_COMMAND_MAX_LATENCY_MS: 2000,
  OCR_TARGET_P95_MS: 3000,
  // Mặc định; ghi đè bằng `ocr_confidence_threshold` khi backend public key này (GAP-25)
  OCR_MIN_CONFIDENCE: 0.5, // VietOCR: xác suất thấp nhất giữa các dòng < ngưỡng → không đọc (BR-24)
  FACE_TARGET_P95_MS: 3000,

  // Face registry upload formats (tham chiếu — upload do web xử lý)
  ALLOWED_IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png'],

  // Auth
  PASSWORD_MIN_LENGTH: 8,
} as const;
