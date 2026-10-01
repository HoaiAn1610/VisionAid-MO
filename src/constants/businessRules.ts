// Giá trị mặc định, khớp VisionAid-BE/src/Shared/Common/BusinessRules.cs. /system-configs chỉ Admin đọc được → chưa ghi đè runtime (GAP-6).
export const BusinessRules = {
  // AI thresholds
  YOLO_DEFAULT_CONFIDENCE: 0.5, // yolo_confidence_threshold
  FACENET_DEFAULT_SIMILARITY: 0.75, // facenet_similarity_threshold (so sánh STRICT >)
  YOLO_MAX_INFERENCE_MS: 500,
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
