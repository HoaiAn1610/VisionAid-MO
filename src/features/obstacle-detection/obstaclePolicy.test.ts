import { Strings } from '@/constants/strings.vi';
import { TtsPriority } from '@/services/tts/TtsService';

import {
  buildAnnouncement,
  estimateDistance,
  selectPriorityObstacle,
  toTtsRequest,
  type LabeledDetection,
} from './obstaclePolicy';

const det = (label: string, over: Partial<LabeledDetection> = {}): LabeledDetection => ({
  label,
  classId: 0,
  score: 0.8,
  x: 0.4,
  y: 0.4,
  w: 0.2,
  h: 0.2,
  ...over,
});

describe('estimateDistance (BR-11: chỉ Near/Medium/Far, không bao giờ ra mét)', () => {
  it('box lớn → Near', () => {
    expect(estimateDistance(det('car', { w: 0.6, h: 0.6 }))).toBe('Near');
  });

  it('box trung bình → Medium', () => {
    expect(estimateDistance(det('car', { w: 0.3, h: 0.3 }))).toBe('Medium');
  });

  it('box nhỏ → Far', () => {
    expect(estimateDistance(det('car', { w: 0.1, h: 0.1 }))).toBe('Far');
  });

  it('vật cao chạm đáy khung (người đứng sát) → Near dù diện tích vừa phải', () => {
    expect(estimateDistance(det('person', { x: 0.4, y: 0.2, w: 0.2, h: 0.78 }))).toBe('Near');
  });
});

describe('selectPriorityObstacle (BR-12)', () => {
  it('ưu tiên vật nguy hiểm trước khoảng cách', () => {
    const picked = selectPriorityObstacle(
      [det('person', { w: 0.6, h: 0.6 }), det('motorcycle', { w: 0.3, h: 0.3 })],
      'Full',
    );
    expect(picked?.label).toBe('motorcycle');
  });

  it('cùng mức nguy hiểm → vật gần hơn', () => {
    const picked = selectPriorityObstacle(
      [det('car', { w: 0.1, h: 0.1 }), det('bus', { w: 0.6, h: 0.6 })],
      'Full',
    );
    expect(picked?.label).toBe('bus');
  });

  it('cùng nguy hiểm, cùng khoảng cách → confidence cao hơn', () => {
    const picked = selectPriorityObstacle(
      [det('car', { score: 0.6 }), det('truck', { score: 0.9 })],
      'Full',
    );
    expect(picked?.label).toBe('truck');
  });

  it('Minimal mode chỉ giữ vật nguy hiểm', () => {
    expect(selectPriorityObstacle([det('person', { w: 0.6, h: 0.6 })], 'Minimal')).toBeNull();
    expect(selectPriorityObstacle([det('bicycle')], 'Minimal')?.label).toBe('bicycle');
  });

  it('bỏ qua class không có trong danh sách vật cản (cốc, dĩa…)', () => {
    expect(selectPriorityObstacle([det('cup', { w: 0.6, h: 0.6 })], 'Full')).toBeNull();
  });

  it('danh sách rỗng → null', () => {
    expect(selectPriorityObstacle([], 'Full')).toBeNull();
  });
});

describe('toTtsRequest', () => {
  it('vật nguy hiểm → DANGER (ngắt câu đang đọc), cooldown theo class', () => {
    const pick = selectPriorityObstacle([det('car', { w: 0.6, h: 0.6 })], 'Full');
    expect(toTtsRequest(pick!)).toEqual({
      text: `Ô tô ${Strings.distance.Near}`,
      priority: TtsPriority.DANGER,
      cooldownKey: 'car',
      maxAgeMs: expect.any(Number),
      urgency: 2,
    });
  });

  it('mức khẩn theo khoảng cách: xa 0 < phía trước 1 < gần 2', () => {
    const urgencyOf = (w: number, h: number) =>
      toTtsRequest(selectPriorityObstacle([det('car', { w, h })], 'Full')!).urgency;
    expect([urgencyOf(0.1, 0.1), urgencyOf(0.3, 0.3), urgencyOf(0.6, 0.6)]).toEqual([0, 1, 2]);
  });

  it('vật thường → INFO', () => {
    const pick = selectPriorityObstacle([det('person')], 'Full');
    expect(toTtsRequest(pick!).priority).toBe(TtsPriority.INFO);
  });

  it('câu cũ hơn một chu kỳ bị bỏ (maxAgeMs ≤ 1 giây, §9.2)', () => {
    const pick = selectPriorityObstacle([det('person')], 'Full');
    expect(toTtsRequest(pick!).maxAgeMs).toBeLessThanOrEqual(1000);
  });
});

describe('buildAnnouncement', () => {
  it('"{Tên vật} {khoảng cách}" tiếng Việt, không có số', () => {
    const text = buildAnnouncement({ label: 'motorcycle', distance: 'Near' });
    expect(text).toBe(`Xe máy ${Strings.distance.Near}`);
    expect(text).not.toMatch(/\d|mét/);
  });
});
