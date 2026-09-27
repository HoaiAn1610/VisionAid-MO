// Giải mã output YOLOv8 (TFLite) + NMS. Chạy trong frame processor → mọi hàm đánh dấu 'worklet',
// không dùng closure/đối tượng ngoài (Map, class) để tương thích worklets-core.

export interface Detection {
  classId: number;
  score: number;
  /** Góc trên-trái + kích thước, chuẩn hóa 0–1 theo khung ảnh đưa vào model. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Output YOLOv8: [1, 4 + numClasses, numAnchors], channels-first — `data[c * numAnchors + i]`.
 * 4 kênh đầu là cx, cy, w, h (0–1, hoặc pixel của input → truyền `inputSize` để chuẩn hóa).
 */
export function decodeYoloOutput(
  data: Float32Array,
  numAnchors: number,
  numClasses: number,
  confThreshold: number,
  inputSize = 1,
): Detection[] {
  'worklet';
  const out: Detection[] = [];
  for (let i = 0; i < numAnchors; i++) {
    let best = 0;
    let classId = -1;
    for (let k = 0; k < numClasses; k++) {
      const s = data[(4 + k) * numAnchors + i] ?? 0;
      if (s > best) {
        best = s;
        classId = k;
      }
    }
    if (best < confThreshold || classId < 0) continue;

    const cx = (data[i] ?? 0) / inputSize;
    const cy = (data[numAnchors + i] ?? 0) / inputSize;
    const w = (data[2 * numAnchors + i] ?? 0) / inputSize;
    const h = (data[3 * numAnchors + i] ?? 0) / inputSize;
    const x1 = Math.max(0, cx - w / 2);
    const y1 = Math.max(0, cy - h / 2);
    const x2 = Math.min(1, cx + w / 2);
    const y2 = Math.min(1, cy + h / 2);
    out.push({ classId, score: best, x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
  }
  return out;
}

function iou(a: Detection, b: Detection): number {
  'worklet';
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const union = a.w * a.h + b.w * b.h - inter;
  return union <= 0 ? 0 : inter / union;
}

/** NMS theo từng class (không loại box khác class chồng lên nhau). */
export function nonMaxSuppression(
  detections: Detection[],
  iouThreshold: number,
  maxDetections = 20,
): Detection[] {
  'worklet';
  const sorted = detections.slice().sort((a, b) => b.score - a.score);
  const kept: Detection[] = [];
  for (const d of sorted) {
    if (kept.length >= maxDetections) break;
    let suppressed = false;
    for (const k of kept) {
      if (k.classId === d.classId && iou(k, d) > iouThreshold) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) kept.push(d);
  }
  return kept;
}
