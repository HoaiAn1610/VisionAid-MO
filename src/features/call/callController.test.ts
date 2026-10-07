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
    await jest.advanceTimersByTimeAsync(50_000);
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
});
