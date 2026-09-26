// Khớp DB v8.0 — CLAUDE.md mục 7
export type UserRole = 'Admin' | 'CenterAdmin' | 'Caregiver' | 'VisuallyImpaired'; // JWT claim
export type DbUserRole = 'ADMIN' | 'CENTER_ADMIN' | 'CAREGIVER' | 'VISUALLY_IMPAIRED'; // có thể xuất hiện trong response API (TBC)
// → Luôn so sánh role qua isVisuallyImpaired() trong src/utils/role.ts
export type TtsVoiceGender = 'MALE' | 'FEMALE';
export type DetectionMode = 'MINIMAL' | 'FULL';
export type DistanceRange = 'NEAR' | 'MEDIUM' | 'FAR';
export type RecognitionResult = 'MATCHED' | 'NOT_MATCHED' | 'LOW_CONFIDENCE' | 'ERROR';
export type OcrRequestType = 'TEXT_READING' | 'QR_CODE';
export type TriggerMethod = 'VOICE_COMMAND' | 'TAP';
export type OcrResultStatus = 'SUCCESS' | 'LOW_CONFIDENCE' | 'FAILED' | 'RETRIED';
export type DetectionMethod = 'ACCELEROMETER_CAMERA' | 'MANUAL' | 'VOICE_COMMAND' | 'GESTURE';
export type AlertStatus =
  'DETECTED' | 'DISMISSED' | 'SENT' | 'ACKNOWLEDGED' | 'ESCALATED' | 'RESOLVED' | 'CALLED';
export type CommandStatus = 'SUCCESS' | 'FAILED' | 'UNRECOGNIZED' | 'CONFIRMED' | 'CANCELLED';
export type RecognitionEngine = 'GOOGLE_SPEECH' | 'WHISPER';
export type NetworkStatus = 'WIFI' | 'MOBILE_4G' | 'MOBILE_3G' | 'OFFLINE';
export type DeviceType = 'ANDROID' | 'IOS' | 'WEB';
export type EmergencyContactType = 'PHONE' | 'ZALO' | 'BOTH';
export type NotificationType =
  | 'FALL_DETECTED'
  | 'EMERGENCY_MANUAL'
  | 'GEOFENCE_BREACH'
  | 'ARRIVAL_NOTIFICATION'
  | 'SYSTEM_ALERT';
