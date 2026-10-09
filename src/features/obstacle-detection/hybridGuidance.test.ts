import { Strings } from '@/constants/strings.vi';

import {
  createGuidanceController,
  decideLocally,
  guidanceText,
  positionOf,
  toGuidanceObjects,
  type GuidanceDeps,
  type GuidanceObject,
} from './hybridGuidance';

const obj = (cls: string, position: GuidanceObject['position']): GuidanceObject => ({
  class: cls,
  confidence: 0.8,
  distance: 'MEDIUM',
  position,
});

describe('positionOf', () => {
  it('5 dải đều nhau theo tâm box', () => {
    expect(positionOf({ x: 0, w: 0.1 })).toBe('LEFT');
    expect(positionOf({ x: 0.3, w: 0.1 })).toBe('CENTER_LEFT');
    expect(positionOf({ x: 0.45, w: 0.1 })).toBe('CENTER');
    expect(positionOf({ x: 0.65, w: 0.1 })).toBe('CENTER_RIGHT');
    expect(positionOf({ x: 0.9, w: 0.2 })).toBe('RIGHT'); // tâm vượt 1 vẫn là RIGHT
  });
});

describe('toGuidanceObjects', () => {
  it('bỏ vật NEAR (đã cảnh báo trên máy) và class app không có tên tiếng Việt', () => {
    const base = { classId: 0, score: 0.876, y: 0, w: 0.1, h: 0.1 };
    const out = toGuidanceObjects([
      { ...base, label: 'car', x: 0.9, distance: 'Medium' },
      { ...base, label: 'car', x: 0.4, distance: 'Near' },
      { ...base, label: 'toothbrush', x: 0.4, distance: 'Far' },
    ]);
    expect(out).toEqual([
      { class: 'car', confidence: 0.88, distance: 'MEDIUM', position: 'RIGHT' },
    ]);
  });
});

describe('decideLocally (chép RuleBasedDecisionEngine.cs)', () => {
  it('giữa → STOP, phải → sang trái, trái → sang phải, không có → đi tiếp', () => {
    expect(decideLocally([obj('car', 'RIGHT'), obj('person', 'CENTER_LEFT')]).action).toBe('STOP');
    expect(decideLocally([obj('car', 'LEFT'), obj('car', 'RIGHT')]).action).toBe('TURN_LEFT');
    expect(decideLocally([obj('car', 'LEFT')]).action).toBe('TURN_RIGHT');
    expect(decideLocally([]).action).toBe('PROCEED');
  });

  it('câu đọc dùng tên tiếng Việt của app', () => {
    expect(guidanceText(decideLocally([obj('car', 'RIGHT')]))).toBe(
      'Có ô tô phía bên phải, hãy bước sang trái',
    );
  });
});

describe('createGuidanceController', () => {
  let t = 0;
  const setup = (over: Partial<GuidanceDeps> = {}) => {
    const deps: GuidanceDeps = {
      serverSessionId: jest.fn(async () => 'server-1'),
      requestGuidance: jest.fn(async () => 'TURN_RIGHT' as const),
      say: jest.fn(),
      now: () => t,
      ...over,
    };
    return { c: createGuidanceController(deps), deps };
  };
  beforeEach(() => {
    t = 10_000;
  });

  it('có phiên server → đọc theo action của server, gửi frameId tăng dần', async () => {
    const { c, deps } = setup();
    await c.onScene([obj('car', 'LEFT')]);
    expect(deps.requestGuidance).toHaveBeenCalledWith('server-1', 1, [obj('car', 'LEFT')]);
    expect(deps.say).toHaveBeenCalledWith('Có ô tô phía bên trái, hãy bước sang phải');
  });

  it('server lỗi / quá ngưỡng → luật trên máy, vẫn đọc', async () => {
    const { c, deps } = setup({
      requestGuidance: jest.fn().mockRejectedValue(new Error('timeout')),
    });
    await c.onScene([obj('car', 'CENTER')]);
    expect(deps.say).toHaveBeenCalledWith(Strings.guidance.stop);
  });

  it('chưa có phiên server (offline) → không gọi server', async () => {
    const { c, deps } = setup({ serverSessionId: jest.fn(async () => null) });
    await c.onScene([obj('car', 'RIGHT')]);
    expect(deps.requestGuidance).not.toHaveBeenCalled();
    expect(deps.say).toHaveBeenCalledWith('Có ô tô phía bên phải, hãy bước sang trái');
  });

  it('cảnh không đổi / dưới 1 giây → không hỏi lại; câu giống hệt chỉ nhắc sau 5 giây', async () => {
    const { c, deps } = setup({ serverSessionId: jest.fn(async () => null) });
    await c.onScene([obj('car', 'RIGHT')]);
    await c.onScene([obj('car', 'RIGHT')]); // không đổi
    t += 500;
    await c.onScene([obj('bus', 'RIGHT')]); // đổi nhưng < 1 s
    expect(deps.say).toHaveBeenCalledTimes(1);
    t += 1000;
    await c.onScene([obj('car', 'RIGHT'), obj('car', 'RIGHT')]); // đổi, câu giống, < 5 s
    expect(deps.say).toHaveBeenCalledTimes(1);
  });

  it('"đường thông thoáng" chỉ đọc khi vừa hết vật cản, không đọc lúc mới bắt đầu', async () => {
    const { c, deps } = setup({ serverSessionId: jest.fn(async () => null) });
    await c.onScene([]);
    expect(deps.say).not.toHaveBeenCalled();
    t += 1000;
    await c.onScene([obj('car', 'CENTER')]);
    t += 1000;
    await c.onScene([]);
    expect(deps.say).toHaveBeenLastCalledWith(Strings.guidance.proceed);
  });
});
