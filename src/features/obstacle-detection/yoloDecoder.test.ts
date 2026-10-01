import {
  decodeYoloOutput,
  fitInside,
  LETTERBOX_FILL,
  letterbox,
  nonMaxSuppression,
  unletterbox,
  type Detection,
} from './yoloDecoder';

const CLASSES = 3;

/**
 * Dựng tensor output YOLOv8 dạng [1, 4 + classes, anchors] (channels-first, như bản export TFLite):
 * data[c * anchors + i] — c = 0..3 là cx, cy, w, h; c = 4.. là điểm từng class.
 */
function tensor(anchors: { box: [number, number, number, number]; scores: number[] }[]) {
  const n = anchors.length;
  const data = new Float32Array((4 + CLASSES) * n);
  anchors.forEach((a, i) => {
    a.box.forEach((v, c) => (data[c * n + i] = v));
    a.scores.forEach((s, k) => (data[(4 + k) * n + i] = s));
  });
  return { data, n };
}

describe('decodeYoloOutput', () => {
  it('lấy class có điểm cao nhất mỗi anchor, lọc theo ngưỡng confidence', () => {
    const { data, n } = tensor([
      { box: [0.5, 0.5, 0.2, 0.4], scores: [0.1, 0.9, 0.2] },
      { box: [0.2, 0.2, 0.1, 0.1], scores: [0.3, 0.2, 0.1] }, // dưới ngưỡng
    ]);
    const dets = decodeYoloOutput(data, n, CLASSES, 0.5);
    expect(dets).toHaveLength(1);
    expect(dets[0]).toMatchObject({ classId: 1, score: expect.closeTo(0.9, 5) });
    // cx,cy,w,h → x,y góc trên-trái (chuẩn hóa 0–1)
    expect(dets[0]?.x).toBeCloseTo(0.4, 5);
    expect(dets[0]?.y).toBeCloseTo(0.3, 5);
    expect(dets[0]?.w).toBeCloseTo(0.2, 5);
    expect(dets[0]?.h).toBeCloseTo(0.4, 5);
  });

  it('toạ độ theo pixel của input (320) → tự chuẩn hóa về 0–1', () => {
    const { data, n } = tensor([{ box: [160, 160, 64, 128], scores: [0.8, 0, 0] }]);
    const [d] = decodeYoloOutput(data, n, CLASSES, 0.5, 320);
    expect(d?.x).toBeCloseTo(0.4, 5);
    expect(d?.h).toBeCloseTo(0.4, 5);
  });

  it('box tràn ra ngoài khung → kẹp trong 0–1', () => {
    const { data, n } = tensor([{ box: [0.05, 0.95, 0.2, 0.2], scores: [0.8, 0, 0] }]);
    const [d] = decodeYoloOutput(data, n, CLASSES, 0.5);
    expect(d?.x).toBe(0);
    expect((d?.y ?? 0) + (d?.h ?? 0)).toBeCloseTo(1, 5);
  });
});

describe('nonMaxSuppression', () => {
  const det = (classId: number, score: number, x: number): Detection => ({
    classId,
    score,
    x,
    y: 0.1,
    w: 0.3,
    h: 0.3,
  });

  it('giữ box điểm cao nhất, loại box cùng class chồng lấn mạnh', () => {
    const kept = nonMaxSuppression([det(0, 0.7, 0.12), det(0, 0.9, 0.1)], 0.5);
    expect(kept).toEqual([det(0, 0.9, 0.1)]);
  });

  it('không loại box khác class dù chồng lấn (xe máy đứng cạnh người)', () => {
    expect(nonMaxSuppression([det(0, 0.9, 0.1), det(1, 0.8, 0.1)], 0.5)).toHaveLength(2);
  });

  it('giữ box cùng class nhưng không chồng lấn', () => {
    expect(nonMaxSuppression([det(0, 0.9, 0.0), det(0, 0.8, 0.6)], 0.5)).toHaveLength(2);
  });

  it('giới hạn số box trả về, sắp xếp theo điểm giảm dần', () => {
    const many = [0.6, 0.9, 0.7, 0.8].map((s, i) => det(0, s, i * 0.35));
    expect(nonMaxSuppression(many, 0.5, 2).map((d) => d.score)).toEqual([0.9, 0.8]);
  });
});

describe('letterbox (model thấy cả khung, không cắt)', () => {
  it('fitInside: khung 1280×720 → 320×180, giữ tỉ lệ', () => {
    expect(fitInside(1280, 720, 320)).toEqual({ width: 320, height: 180 });
    expect(fitInside(720, 1280, 320)).toEqual({ width: 180, height: 320 });
  });

  it('ảnh dọc 2×4 đặt giữa ô 4×4, hai bên tô màu viền', () => {
    const src = new Float32Array(2 * 4 * 3).fill(1);
    const { data, padX, padY } = letterbox(src, 2, 4, 4);
    expect([padX, padY]).toEqual([1, 0]);
    const pixel = (x: number, y: number) => data[(y * 4 + x) * 3];
    const fill = Math.fround(LETTERBOX_FILL); // lưu trong Float32Array
    expect([pixel(0, 0), pixel(1, 0), pixel(2, 3), pixel(3, 3)]).toEqual([fill, 1, 1, fill]);
  });

  it('unletterbox: box theo ô vuông → theo ảnh thật; phần lấn ra viền bị cắt', () => {
    // ảnh 180×320 nằm giữa ô 320 (padX 70): box phủ đúng nửa dưới ảnh
    const d: Detection = { classId: 0, score: 1, x: 70 / 320, y: 0.5, w: 180 / 320, h: 0.5 };
    const r = unletterbox(d, 320, 70, 0, 180, 320);
    expect([r.x, r.y, r.w, r.h].map((v) => Math.round(v * 1000) / 1000)).toEqual([0, 0.5, 1, 0.5]);

    const onPad: Detection = { classId: 0, score: 1, x: 0, y: 0, w: 0.1, h: 0.1 };
    expect(unletterbox(onPad, 320, 70, 0, 180, 320).w).toBe(0);
  });
});
