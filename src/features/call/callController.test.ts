import { Strings } from '@/constants/strings.vi';

import {
  createCallController,
  type CallDeps,
  type CallPeer,
  type CallState,
  type PeerCallbacks,
} from './callController';

jest.useFakeTimers();

function setup(over: Partial<CallDeps> = {}) {
  let callbacks: PeerCallbacks | null = null;
  const peer: jest.Mocked<CallPeer> = {
    createOffer: jest.fn(async () => 'offer-sdp'),
    acceptOffer: jest.fn(async (_sdp: string) => 'answer-sdp'),
    acceptAnswer: jest.fn(async (_sdp: string) => undefined),
    addIceCandidate: jest.fn(async (_c: string) => undefined),
    close: jest.fn(),
  };
  const deps: jest.Mocked<CallDeps> = {
    isOnline: jest.fn(() => true),
    fetchIceServers: jest.fn(async () => [{ urls: 'stun:x' }]),
    initiate: jest.fn(async () => 's-out'),
    accept: jest.fn(async () => undefined),
    end: jest.fn(async () => undefined),
    createPeer: jest.fn(async (_ice, cb) => {
      callbacks = cb;
      return peer;
    }),
    relayOffer: jest.fn(async () => undefined),
    relayAnswer: jest.fn(async () => undefined),
    relayIce: jest.fn(async () => undefined),
    holdCamera: jest.fn(async () => undefined),
    releaseCamera: jest.fn(),
    speaker: jest.fn(),
    say: jest.fn(),
    setTimer: jest.fn((fn, ms) => setTimeout(fn, ms)),
    clearTimer: jest.fn((h) => clearTimeout(h as ReturnType<typeof setTimeout>)),
    ringTimeoutMs: jest.fn(() => 45_000),
    maxDurationMs: jest.fn(() => 60 * 60_000),
    ...over,
  } as jest.Mocked<CallDeps>;
  const states: CallState[] = [];
  const c = createCallController(deps, (s) => states.push(s));
  return { c, deps, peer, states, peerCallbacks: () => callbacks! };
}

describe('createCallController', () => {
  it('người chăm sóc gọi → tự nhận, nhường camera rồi mới mở peer, gửi offer', async () => {
    const { c, deps, peer } = setup();
    await c.onIncoming({ sessionId: 's1', callerName: 'Mẹ', triggerType: 'CaregiverInitiated' });
    expect(deps.say).toHaveBeenCalledWith(Strings.call.incoming('Mẹ'));
    expect(deps.accept).toHaveBeenCalledWith('s1');
    expect(deps.holdCamera.mock.invocationCallOrder[0]).toBeLessThan(
      deps.createPeer.mock.invocationCallOrder[0]!,
    );
    expect(peer.createOffer).toHaveBeenCalled();
    expect(deps.relayOffer).toHaveBeenCalledWith('s1', 'offer-sdp');
    expect(c.getState()).toEqual({ phase: 'connecting', sessionId: 's1' });
  });

  it('kết nối xong → loa ngoài + báo cách kết thúc', async () => {
    const { c, deps, peerCallbacks } = setup();
    await c.onIncoming({ sessionId: 's1', triggerType: 'CaregiverInitiated' });
    peerCallbacks().onConnected();
    expect(c.getState().phase).toBe('connected');
    expect(deps.speaker).toHaveBeenCalledWith(true);
    expect(deps.say).toHaveBeenLastCalledWith(Strings.call.connected);
  });

  it('SOS tự động → KHÔNG gọi accept (VIU không phải receiver), chờ người chăm sóc nghe rồi gửi offer', async () => {
    const { c, deps } = setup();
    await c.onIncoming({ sessionId: 'sos', triggerType: 'SosAuto' });
    expect(deps.accept).not.toHaveBeenCalled();
    expect(deps.createPeer).not.toHaveBeenCalled();
    expect(c.getState().phase).toBe('waiting');
    await c.onAccepted({ sessionId: 'sos' });
    expect(deps.relayOffer).toHaveBeenCalledWith('sos', 'offer-sdp');
  });

  it('gọi đi không ai nghe → hết giờ báo, gửi end Missed', async () => {
    const { c, deps } = setup();
    await c.callCaregiver();
    expect(c.getState()).toEqual({ phase: 'outgoing', sessionId: 's-out' });
    await jest.advanceTimersByTimeAsync(64_000);
    expect(deps.end).not.toHaveBeenCalled(); // 45 s đổ chuông + 20 s dự phòng
    await jest.advanceTimersByTimeAsync(2_000);
    expect(deps.end).toHaveBeenCalledWith('s-out', 'Missed');
    expect(deps.say).toHaveBeenLastCalledWith(Strings.call.noAnswer);
    expect(c.getState().phase).toBe('idle');
  });

  it('offline → không gọi, báo cần mạng; đang gọi → báo bận', async () => {
    const { c, deps } = setup({ isOnline: jest.fn(() => false) });
    await c.callCaregiver();
    expect(deps.initiate).not.toHaveBeenCalled();
    expect(deps.say).toHaveBeenCalledWith(Strings.call.needsNetwork);
    const b = setup();
    await b.c.onIncoming({ sessionId: 's1', triggerType: 'SosAuto' });
    await b.c.callCaregiver();
    expect(b.deps.say).toHaveBeenLastCalledWith(Strings.call.busy);
  });

  it('phía kia gửi offer trước → trả answer, không tự tạo offer', async () => {
    const { c, deps, peer } = setup();
    await c.onIncoming({ sessionId: 'sos', triggerType: 'SosAuto' });
    await c.onOffer({ sessionId: 'sos', sdp: 'their-offer' });
    expect(peer.acceptOffer).toHaveBeenCalledWith('their-offer');
    expect(deps.relayAnswer).toHaveBeenCalledWith('sos', 'answer-sdp');
    await c.onAccepted({ sessionId: 'sos' });
    expect(peer.createOffer).not.toHaveBeenCalled();
  });

  it('ICE đến trước khi peer sẵn sàng → giữ lại rồi nạp; event của phiên khác bị bỏ qua', async () => {
    const { c, peer, deps } = setup();
    await c.onIncoming({ sessionId: 'sos', triggerType: 'SosAuto' });
    await c.onIceCandidate({ sessionId: 'sos', candidateJson: '{"candidate":"a"}' });
    await c.onIceCandidate({ sessionId: 'other', candidateJson: '{"candidate":"b"}' });
    await c.onAccepted({ sessionId: 'sos' });
    expect(peer.addIceCandidate).not.toHaveBeenCalled(); // chưa có remote description
    await c.onAnswer({ sessionId: 'sos', sdp: 'their-answer' });
    expect(peer.addIceCandidate).toHaveBeenCalledTimes(1);
    expect(peer.addIceCandidate).toHaveBeenCalledWith('{"candidate":"a"}');
    c.onEnded({ sessionId: 'other' });
    expect(c.getState().phase).toBe('connecting');
    expect(deps.releaseCamera).not.toHaveBeenCalled();
  });

  it('gác máy → báo trước, rồi trả camera + tắt loa, gọi end', async () => {
    const { c, deps, peer, peerCallbacks } = setup();
    await c.onIncoming({ sessionId: 's1', triggerType: 'CaregiverInitiated' });
    peerCallbacks().onConnected();
    await expect(c.hangUp()).resolves.toBe(true);
    expect(peer.close).toHaveBeenCalled();
    expect(deps.speaker).toHaveBeenLastCalledWith(false);
    expect(deps.say.mock.invocationCallOrder.at(-1)!).toBeLessThan(
      deps.releaseCamera.mock.invocationCallOrder[0]!,
    );
    expect(deps.end).toHaveBeenCalledWith('s1', 'UserEnded');
    await expect(c.hangUp()).resolves.toBe(false); // không còn cuộc gọi
  });

  it('gác máy khi đang khởi tạo cuộc gọi đi → hủy phiên vừa tạo trên server', async () => {
    let resolve: (id: string) => void = () => undefined;
    const { c, deps } = setup({
      initiate: jest.fn(() => new Promise<string>((r) => (resolve = r))),
    });
    const calling = c.callCaregiver();
    await c.hangUp();
    resolve('late');
    await calling;
    expect(deps.end).toHaveBeenCalledWith('late', 'Cancelled');
    expect(c.getState().phase).toBe('idle');
  });

  it('server báo kết thúc / từ chối / lỡ cuộc gọi → câu tương ứng', async () => {
    const a = setup();
    await a.c.callCaregiver();
    a.c.onEnded({ sessionId: 's-out' }, true);
    expect(a.deps.say).toHaveBeenLastCalledWith(Strings.call.rejected);
    const b = setup();
    await b.c.callCaregiver();
    b.c.onEnded({ sessionId: 's-out', reason: 'Missed' });
    expect(b.deps.say).toHaveBeenLastCalledWith(Strings.call.noAnswer);
  });

  it('mất kết nối ICE → báo mất kết nối, kết thúc phiên trên server', async () => {
    const { c, deps, peerCallbacks } = setup();
    await c.onIncoming({ sessionId: 's1', triggerType: 'CaregiverInitiated' });
    peerCallbacks().onFailed();
    expect(deps.say).toHaveBeenLastCalledWith(Strings.call.lost);
    expect(deps.end).toHaveBeenCalledWith('s1', 'Failed');
    expect(c.getState().phase).toBe('idle');
  });

  it('accepted và offer đến cùng lúc → chỉ tạo MỘT peer (không mở camera hai lần)', async () => {
    const { c, deps } = setup();
    await c.onIncoming({ sessionId: 'sos', triggerType: 'SosAuto' });
    await Promise.all([
      c.onAccepted({ sessionId: 'sos' }),
      c.onOffer({ sessionId: 'sos', sdp: 'their-offer' }),
    ]);
    expect(deps.createPeer).toHaveBeenCalledTimes(1);
    expect(deps.holdCamera).toHaveBeenCalledTimes(1);
  });

  it('gác máy lúc đang lấy ICE server → không giữ camera', async () => {
    let resolveIce: (v: []) => void = () => undefined;
    const { c, deps } = setup({
      fetchIceServers: jest.fn(() => new Promise<[]>((r) => (resolveIce = r))),
    });
    const pending = c.onIncoming({ sessionId: 's1', triggerType: 'CaregiverInitiated' });
    await Promise.resolve();
    await Promise.resolve();
    await c.hangUp();
    resolveIce([]);
    await pending;
    expect(deps.holdCamera).not.toHaveBeenCalled();
    expect(deps.createPeer).not.toHaveBeenCalled();
  });

  it('gác máy lúc đang chờ camera nhả → tự trả camera, không tạo peer', async () => {
    let resolveHold: () => void = () => undefined;
    const { c, deps } = setup({
      holdCamera: jest.fn(() => new Promise<void>((r) => (resolveHold = r))),
    });
    const pending = c.onIncoming({ sessionId: 's1', triggerType: 'CaregiverInitiated' });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(deps.holdCamera).toHaveBeenCalled();
    await c.hangUp();
    resolveHold();
    await pending;
    expect(deps.releaseCamera).toHaveBeenCalledTimes(2); // cleanup + tự trả sau khi hold xong
    expect(deps.createPeer).not.toHaveBeenCalled();
  });

  it('WebRtcIncomingCall thiếu sessionId → bỏ qua, không kẹt', async () => {
    const { c } = setup();
    await c.onIncoming({ sessionId: '', triggerType: 'SosAuto' });
    expect(c.getState().phase).toBe('idle');
  });

  it('SOS chờ mà lỡ event kết thúc → hết giờ tự đóng (không kẹt lớp phủ)', async () => {
    const { c, deps } = setup();
    await c.onIncoming({ sessionId: 'sos', triggerType: 'SosAuto' });
    await jest.advanceTimersByTimeAsync(66_000);
    expect(c.getState().phase).toBe('idle');
    expect(deps.end).toHaveBeenCalledWith('sos', 'Missed');
  });
});
