import type { DistanceRange } from '@/constants/enums';
import { ObstacleClasses } from '@/constants/obstacleClasses';
import { Strings } from '@/constants/strings.vi';

import type { LabeledDetection } from './obstaclePolicy';

/** 5 dải ngang bằng nhau theo tâm bounding box — khớp validator của `/api/navigation/guidance`. */
export type GuidancePosition = 'LEFT' | 'CENTER_LEFT' | 'CENTER' | 'CENTER_RIGHT' | 'RIGHT';
export type GuidanceAction = 'STOP' | 'TURN_LEFT' | 'TURN_RIGHT' | 'PROCEED';

const BANDS: GuidancePosition[] = ['LEFT', 'CENTER_LEFT', 'CENTER', 'CENTER_RIGHT', 'RIGHT'];

export interface GuidanceObject {
  /** Tên class COCO tiếng Anh (contract backend). */
  class: string;
  confidence: number;
  distance: 'MEDIUM' | 'FAR';
  position: GuidancePosition;
}

export interface GuidanceDecision {
  action: GuidanceAction;
  /** Vật dẫn tới quyết định (để dựng câu) — null với PROCEED. */
  object: GuidanceObject | null;
}

export function positionOf(d: { x: number; w: number }): GuidancePosition {
  const center = Math.min(Math.max(d.x + d.w / 2, 0), 0.999);
  return BANDS[Math.floor(center * BANDS.length)]!;
}

/**
 * Layer 2 của Hybrid AI (§9.1): chỉ vật MEDIUM/FAR (NEAR đã cảnh báo ngay trên máy, không gửi server).
 * Chỉ class có tên tiếng Việt trong app — giống phần cảnh báo vật cản.
 */
export function toGuidanceObjects(
  detections: (LabeledDetection & { distance: DistanceRange })[],
): GuidanceObject[] {
  return detections
    .filter((d) => d.distance !== 'Near' && ObstacleClasses[d.label])
    .map((d) => ({
      class: d.label,
      confidence: Math.round(d.score * 100) / 100,
      distance: d.distance === 'Medium' ? 'MEDIUM' : 'FAR',
      position: positionOf(d),
    }));
}

/** Khóa so sánh "cảnh có đổi không" — chỉ gọi server / đọc khi tập vật đổi. */
export function sceneKey(objects: GuidanceObject[]): string {
  return objects
    .map((o) => `${o.class}|${o.distance}|${o.position}`)
    .sort()
    .join(',');
}

const isCenter = (p: GuidancePosition) =>
  p === 'CENTER' || p === 'CENTER_LEFT' || p === 'CENTER_RIGHT';

/** Chép đúng `RuleBasedDecisionEngine.cs` của backend: giữa → dừng; phải → sang trái; trái → sang phải. */
export function decideLocally(objects: GuidanceObject[]): GuidanceDecision {
  const pick = (match: (p: GuidancePosition) => boolean) =>
    objects.find((o) => match(o.position)) ?? null;
  const center = pick(isCenter);
  if (center) return { action: 'STOP', object: center };
  const right = pick((p) => p === 'RIGHT');
  if (right) return { action: 'TURN_LEFT', object: right };
  const left = pick((p) => p === 'LEFT');
  if (left) return { action: 'TURN_RIGHT', object: left };
  return { action: 'PROCEED', object: null };
}

/**
 * Server trả `action` (JEV / Groq / Rule-Based) nhưng không trả vật nào → chọn vật khớp vị trí của
 * action theo cùng luật, để dựng câu bằng tên tiếng Việt của app.
 */
export function objectForAction(
  action: GuidanceAction,
  objects: GuidanceObject[],
): GuidanceObject | null {
  const match: Record<GuidanceAction, (p: GuidancePosition) => boolean> = {
    STOP: isCenter,
    TURN_LEFT: (p) => p === 'RIGHT',
    TURN_RIGHT: (p) => p === 'LEFT',
    PROCEED: () => false,
  };
  return objects.find((o) => match[action](o.position)) ?? null;
}

/**
 * Câu đọc — cùng mẫu với `TtsTemplateHelper.cs` của backend, nhưng tên vật lấy từ bảng tiếng Việt của
 * app (backend chưa map đủ class, GAP-23) → server hay máy quyết định đều nghe giống nhau.
 */
export function guidanceText(d: GuidanceDecision): string {
  const name = d.object ? (ObstacleClasses[d.object.class]?.nameVi.toLowerCase() ?? null) : null;
  const where = d.object ? Strings.guidance.position[d.object.position] : null;
  switch (d.action) {
    case 'STOP':
      return Strings.guidance.stop;
    case 'TURN_LEFT':
      return Strings.guidance.turnLeft(name, where);
    case 'TURN_RIGHT':
      return Strings.guidance.turnRight(name, where);
    case 'PROCEED':
      return Strings.guidance.proceed;
  }
}

/** Tối đa 1 quyết định/giây (server ghi 1 dòng log mỗi request — GAP-23). */
export const GUIDANCE_MIN_INTERVAL_MS = 1000;
/** Cùng một câu hướng dẫn chỉ nhắc lại sau khoảng này. */
export const GUIDANCE_REPEAT_MS = 5000;

export interface GuidanceDeps {
  /** `hybrid_navigation_enabled` + online + đã có id phiên phía server → hỏi server. */
  serverSessionId(): Promise<string | null>;
  requestGuidance(
    sessionId: string,
    frameId: number,
    objects: GuidanceObject[],
  ): Promise<GuidanceAction>;
  say(text: string): void;
  now(): number;
}

/**
 * Điều phối Layer 2 (§9.1): mỗi khi tập vật MEDIUM/FAR đổi → hỏi Decision Engine (JEV → Groq →
 * Rule-Based); không hỏi được (offline, chưa có phiên server, lỗi, quá ngưỡng) → luật Rule-Based trên
 * máy. Không đọc lặp; "đường thông thoáng" chỉ đọc khi vừa hết vật cản.
 */
export function createGuidanceController(deps: GuidanceDeps) {
  let lastKey: string | null = null;
  let lastDecisionAt = -Infinity;
  let inFlight = false;
  let frameId = 0;
  let lastText: string = Strings.guidance.proceed;
  let lastSpokenAt = -Infinity;

  async function decide(objects: GuidanceObject[]): Promise<GuidanceDecision> {
    if (objects.length === 0) return { action: 'PROCEED', object: null };
    const sessionId = await deps.serverSessionId().catch(() => null);
    if (sessionId) {
      try {
        const action = await deps.requestGuidance(sessionId, ++frameId, objects);
        return { action, object: objectForAction(action, objects) };
      } catch {
        // timeout / lỗi mạng / 4xx → luật trên máy, không im lặng
      }
    }
    return decideLocally(objects);
  }

  return {
    async onScene(objects: GuidanceObject[]): Promise<void> {
      const key = sceneKey(objects);
      const now = deps.now();
      if (inFlight || key === lastKey || now - lastDecisionAt < GUIDANCE_MIN_INTERVAL_MS) return;
      lastKey = key;
      lastDecisionAt = now;
      inFlight = true;
      try {
        const decision = await decide(objects);
        const text = guidanceText(decision);
        const repeat = text === lastText;
        if (
          repeat &&
          (decision.action === 'PROCEED' || deps.now() - lastSpokenAt < GUIDANCE_REPEAT_MS)
        ) {
          return;
        }
        lastText = text;
        lastSpokenAt = deps.now();
        deps.say(text);
      } finally {
        inFlight = false;
      }
    },

    reset(): void {
      lastKey = null;
      lastDecisionAt = -Infinity;
      frameId = 0;
      lastText = Strings.guidance.proceed;
      lastSpokenAt = -Infinity;
    },
  };
}

export type GuidanceController = ReturnType<typeof createGuidanceController>;
