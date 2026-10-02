// Khớp backend (JsonStringEnumConverter mặc định → tên enum C# PascalCase).
// Nguồn: docs/api/openapi.json + VisionAid-BE/src/Shared (đối chiếu 2026-09-27).
// DB lưu SCREAMING_SNAKE_CASE nhưng JSON API KHÔNG dùng dạng đó.
export type UserRole = 'Admin' | 'CenterAdmin' | 'Caregiver' | 'VisuallyImpaired';
export type TtsVoiceGender = 'Male' | 'Female';
export type DetectionMode = 'Minimal' | 'Full';
export type DistanceRange = 'Near' | 'Medium' | 'Far';
export type RecognitionResult = 'Matched' | 'NotMatched' | 'LowConfidence' | 'Error';
export type OcrRequestType = 'TextReading' | 'QrCode';
export type TriggerMethod = 'VoiceCommand' | 'Tap';
export type OcrResultStatus = 'Success' | 'LowConfidence' | 'Failed' | 'Retried';
export type DetectionMethod = 'AccelerometerCamera' | 'Manual' | 'VoiceCommand' | 'Gesture';
export type AlertStatus =
  'Detected' | 'Dismissed' | 'Sent' | 'Acknowledged' | 'Escalated' | 'Resolved' | 'Called';
export type CommandStatus = 'Success' | 'Failed' | 'Unrecognized' | 'Confirmed' | 'Cancelled';
// Backend nhận chuỗi tự do (không phải enum) — thống nhất giá trị với team
export type RecognitionEngine = 'GoogleSpeech' | 'GoogleOnDevice';
export type NetworkStatus = 'Wifi' | 'Mobile4G' | 'Mobile3G' | 'Offline';
export type DeviceType = 'Android' | 'Ios' | 'Web';
export type EmergencyContactType = 'Phone' | 'Zalo' | 'Both';
export type NotificationType =
  'FallDetected' | 'EmergencyManual' | 'GeofenceBreach' | 'ArrivalNotification' | 'SystemAlert';
