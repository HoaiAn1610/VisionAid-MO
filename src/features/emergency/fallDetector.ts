import { BusinessRules } from '@/constants/businessRules';

/** Mẫu gia tốc kế (đơn vị g, như expo-sensors trả về). */
export interface AccelSample {
  x: number;
  y: number;
  z: number;
  t: number;
}

export interface FallEvent {
  /** Thời điểm va chạm — gửi làm `detectedAt` (server tính 15 s grace từ đây). */
  impactAt: number;
  /** Chuỗi JSON gửi trong `accelerometerData`. */
  accelerometerData: string;
}

export interface FallDetectorConfig {
  freeFallG: number;
  impactG: number;
  /** Va chạm phải xảy ra trong khoảng này sau pha rơi tự do. */
  freeFallToImpactMs: number;
  /** Camera phải đứng yên liên tục chừng này sau va chạm. */
  stillMs: number;
  /** Quá thời gian này sau va chạm mà camera chưa đứng yên đủ lâu → bỏ (người đã đứng dậy đi tiếp). */
  maxWaitMs: number;
  /** Chênh lệch trung bình giữa hai chữ ký khung hình (0–1) dưới mức này = đứng yên. */
  stillDiff: number;
}

export const DEFAULT_FALL_CONFIG: FallDetectorConfig = {
  freeFallG: BusinessRules.FALL_FREE_FALL_G,
  impactG: BusinessRules.FALL_IMPACT_G,
  freeFallToImpactMs: 1000,
  stillMs: BusinessRules.FALL_CAMERA_STILL_SECONDS * 1000,
  maxWaitMs: 15_000,
  stillDiff: BusinessRules.FALL_CAMERA_STILL_DIFF,
};

const magnitude = (s: AccelSample) => Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);

/** Chênh lệch tuyệt đối trung bình giữa hai chữ ký (lưới độ sáng 0–1, cùng kích thước). */
export function signatureDiff(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || a.length !== b.length) return 1;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i]! - b[i]!);
  return sum / a.length;
}

/**
 * Phát hiện té ngã (BR-26) — CHỈ báo khi có CẢ HAI tín hiệu:
 * 1. gia tốc kế: rơi tự do rồi va chạm mạnh;
 * 2. camera: khung hình gần như không đổi liên tục `stillMs` sau va chạm.
 * Một tín hiệu đơn lẻ (rung mạnh khi đi, đặt điện thoại xuống bàn) không bao giờ báo.
 */
export function createFallDetector(
  onFall: (event: FallEvent) => void,
  config: FallDetectorConfig = DEFAULT_FALL_CONFIG,
) {
  let lastFreeFallAt = -Infinity;
  let impact: { at: number; peakG: number } | null = null;
  let stillSince: number | null = null;
  let prevSignature: readonly number[] | null = null;

  const reset = () => {
    impact = null;
    stillSince = null;
  };

  return {
    onAccel(sample: AccelSample): void {
      const g = magnitude(sample);
      if (g < config.freeFallG) lastFreeFallAt = sample.t;
      else if (g > config.impactG && sample.t - lastFreeFallAt <= config.freeFallToImpactMs) {
        if (impact && sample.t - impact.at < config.freeFallToImpactMs) {
          impact.peakG = Math.max(impact.peakG, g); // còn trong cú va chạm hiện tại
        } else {
          impact = { at: sample.t, peakG: g };
          stillSince = null;
        }
      }
    },

    onFrame(signature: readonly number[], t: number): void {
      const prev = prevSignature;
      prevSignature = signature;
      if (!impact || t < impact.at) return;
      if (t - impact.at > config.maxWaitMs + config.stillMs) return reset();
      const still = prev !== null && signatureDiff(prev, signature) < config.stillDiff;
      if (!still) {
        stillSince = null;
        if (t - impact.at > config.maxWaitMs) reset();
        return;
      }
      stillSince ??= t;
      if (t - stillSince >= config.stillMs) {
        const event: FallEvent = {
          impactAt: impact.at,
          accelerometerData: JSON.stringify({
            impactAt: new Date(impact.at).toISOString(),
            peakG: Math.round(impact.peakG * 100) / 100,
            stillMs: t - stillSince,
          }),
        };
        reset();
        onFall(event);
      }
    },

    reset,
  };
}
