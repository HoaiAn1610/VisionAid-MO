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

/** Màu viền letterbox chuẩn của YOLO (114/255) — model được huấn luyện với viền màu này. */
export const LETTERBOX_FILL = 114 / 255;

/** Kích thước ảnh sau khi thu nhỏ để cạnh dài = `size` (giữ tỉ lệ, không cắt). */
export function fitInside(
  width: number,
  height: number,
  size: number,
): { width: number; height: number } {
  'worklet';
  return width >= height
    ? { width: size, height: Math.round((size * height) / width) }
    : { width: Math.round((size * width) / height), height: size };
}

/**
 * Letterbox: đặt ảnh RGB `srcW×srcH` (float, HWC) vào giữa ô vuông `size×size`, phần thừa tô xám
 * → model thấy TOÀN BỘ khung hình (không mất đáy khung — nơi có bậc thang, hố, vật thấp).
 */
export function letterbox(
  src: Float32Array,
  srcW: number,
  srcH: number,
  size: number,
): { data: Float32Array; padX: number; padY: number } {
  'worklet';
  const data = new Float32Array(size * size * 3).fill(LETTERBOX_FILL);
  const padX = Math.floor((size - srcW) / 2);
  const padY = Math.floor((size - srcH) / 2);
  const rowLen = srcW * 3;
  for (let r = 0; r < srcH; r++) {
    data.set(src.subarray(r * rowLen, (r + 1) * rowLen), ((r + padY) * size + padX) * 3);
  }
  return { data, padX, padY };
}

/** Đổi box (0–1 theo ô vuông letterbox) về 0–1 theo ảnh thật, cắt phần lấn ra viền. */
export function unletterbox(
  d: Detection,
  size: number,
  padX: number,
  padY: number,
  contentW: number,
  contentH: number,
): Detection {
  'worklet';
  const x1 = Math.max(0, (d.x * size - padX) / contentW);
  const y1 = Math.max(0, (d.y * size - padY) / contentH);
  const x2 = Math.min(1, ((d.x + d.w) * size - padX) / contentW);
  const y2 = Math.min(1, ((d.y + d.h) * size - padY) / contentH);
  return { ...d, x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}

/** Kích thước lưới chữ ký khung hình (8×8 ô độ sáng). */
export const SIGNATURE_GRID = 8;

/**
 * Chữ ký khung hình cho phát hiện té ngã (BR-26, tín hiệu camera): độ sáng trung bình 0–1 của lưới
 * 8×8 trên ảnh RGB đã thu nhỏ cho YOLO (lấy mẫu cách 2 px, rất nhẹ). Hai chữ ký gần như trùng nhau
 * = camera đứng yên.
 */
export function frameSignature(rgb: Float32Array, width: number, height: number): number[] {
  'worklet';
  const cells = SIGNATURE_GRID * SIGNATURE_GRID;
  const sums: number[] = [];
  const counts: number[] = [];
  for (let i = 0; i < cells; i++) {
    sums.push(0);
    counts.push(0);
  }
  for (let y = 0; y < height; y += 2) {
    const row = Math.min(SIGNATURE_GRID - 1, Math.floor((y * SIGNATURE_GRID) / height));
    for (let x = 0; x < width; x += 2) {
      const col = Math.min(SIGNATURE_GRID - 1, Math.floor((x * SIGNATURE_GRID) / width));
      const p = (y * width + x) * 3;
      const cell = row * SIGNATURE_GRID + col;
      sums[cell] = sums[cell]! + 0.299 * rgb[p]! + 0.587 * rgb[p + 1]! + 0.114 * rgb[p + 2]!;
      counts[cell] = counts[cell]! + 1;
    }
  }
  const out: number[] = [];
  for (let i = 0; i < cells; i++) out.push(counts[i]! > 0 ? sums[i]! / counts[i]! : 0);
  return out;
}
