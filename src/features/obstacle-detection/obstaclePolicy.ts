import { BusinessRules } from '@/constants/businessRules';
import type { DetectionMode, DistanceRange } from '@/constants/enums';
import { ObstacleClasses } from '@/constants/obstacleClasses';
import { Strings } from '@/constants/strings.vi';
import { TtsPriority, type TtsRequest } from '@/services/tts/TtsService';

import type { Detection } from './yoloDecoder';

export type LabeledDetection = Detection & { label: string };

export interface PriorityObstacle extends LabeledDetection {
  nameVi: string;
  dangerous: boolean;
  distance: DistanceRange;
}

const DISTANCE_RANK: Record<DistanceRange, number> = { Near: 0, Medium: 1, Far: 2 };

/**
 * BR-11: chỉ phân loại Near/Medium/Far từ kích thước box, KHÔNG BAO GIỜ ra số mét.
 * ponytail: heuristic diện tích + chiều cao box; chưa tính tiêu cự camera hay kích thước thật của
 * từng class — hiệu chỉnh ngưỡng trong BusinessRules khi thử thực tế.
 */
export function estimateDistance(d: Detection): DistanceRange {
  const area = d.w * d.h;
  if (area >= BusinessRules.DISTANCE_NEAR_AREA || d.h >= BusinessRules.DISTANCE_NEAR_HEIGHT) {
    return 'Near';
  }
  if (area >= BusinessRules.DISTANCE_MEDIUM_AREA) return 'Medium';
  return 'Far';
}

/**
 * Chống báo nhầm do một frame lẻ: chỉ giữ detection có class cũng được thấy trong `windowMs` vừa qua
 * (frame trước). Cập nhật `lastSeen` (class → thời điểm thấy gần nhất) cho lần gọi sau.
 */
export function confirmAcrossFrames(
  detections: LabeledDetection[],
  lastSeen: Map<string, number>,
  now: number,
  windowMs: number,
): LabeledDetection[] {
  const confirmed = detections.filter((d) => {
    const seenAt = lastSeen.get(d.label);
    return seenAt !== undefined && now - seenAt <= windowMs;
  });
  for (const d of detections) lastSeen.set(d.label, now);
  return confirmed;
}

/**
 * BR-12: mỗi chu kỳ chỉ announce MỘT vật — nguy hiểm trước, rồi gần hơn, rồi confidence cao hơn.
 * Minimal Mode chỉ xét vật có cờ `dangerous`. Class không có tên tiếng Việt thì bỏ qua.
 */
export function selectPriorityObstacle(
  detections: LabeledDetection[],
  mode: DetectionMode,
): PriorityObstacle | null {
  let best: PriorityObstacle | null = null;
  for (const d of detections) {
    const info = ObstacleClasses[d.label];
    if (!info || (mode === 'Minimal' && !info.dangerous)) continue;
    const candidate: PriorityObstacle = {
      ...d,
      nameVi: info.nameVi,
      dangerous: info.dangerous,
      distance: estimateDistance(d),
    };
    if (!best || compare(candidate, best) < 0) best = candidate;
  }
  return best;
}

function compare(a: PriorityObstacle, b: PriorityObstacle): number {
  if (a.dangerous !== b.dangerous) return a.dangerous ? -1 : 1;
  const byDistance = DISTANCE_RANK[a.distance] - DISTANCE_RANK[b.distance];
  if (byDistance !== 0) return byDistance;
  return b.score - a.score;
}

/** Câu TTS ngắn: "{Tên vật tiếng Việt} {ở gần | phía trước | ở xa}". */
export function buildAnnouncement(o: { label: string; distance: DistanceRange }): string {
  const name = ObstacleClasses[o.label]?.nameVi ?? o.label;
  return `${name} ${Strings.distance[o.distance]}`;
}

/** Câu announce vật cản cũ hơn khoảng một chu kỳ thì bỏ, không đọc tin đã lỗi thời (§9.2). */
const ANNOUNCEMENT_MAX_AGE_MS = 800;

/**
 * Vật nguy hiểm → DANGER (ngắt câu thấp hơn); còn lại INFO. Cooldown 3s theo class (BR-13),
 * NGOẠI LỆ an toàn: vật gần hơn lần đọc trước (xa → phía trước → gần) được đọc ngay.
 */
export function toTtsRequest(o: PriorityObstacle): TtsRequest {
  return {
    text: buildAnnouncement(o),
    priority: o.dangerous ? TtsPriority.DANGER : TtsPriority.INFO,
    cooldownKey: o.label,
    maxAgeMs: ANNOUNCEMENT_MAX_AGE_MS,
    urgency: DISTANCE_RANK.Far - DISTANCE_RANK[o.distance],
  };
}
