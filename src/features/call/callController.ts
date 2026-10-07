import type { IceServer } from '@/api/endpoints/webrtc';
import { Strings } from '@/constants/strings.vi';
import { logger } from '@/utils/logger';

/**
 * idle → (gọi đi) outgoing → (người chăm sóc nghe) connecting → connected
 * idle → (SOS tự động) waiting → (người chăm sóc nghe) connecting → connected
 * idle → (người chăm sóc gọi, tự nhận) connecting → connected
 */
export type CallPhase = 'idle' | 'outgoing' | 'waiting' | 'connecting' | 'connected';

export interface CallState {
  phase: CallPhase;
  sessionId: string | null;
}

/** Kết nối WebRTC một phía VIU: gửi camera sau + micro, chỉ nghe tiếng người chăm sóc. */
export interface CallPeer {
  createOffer(): Promise<string>;
  /** Nhận offer của phía kia → trả SDP answer. */
  acceptOffer(sdp: string): Promise<string>;
  acceptAnswer(sdp: string): Promise<void>;
  addIceCandidate(candidateJson: string): Promise<void>;
  close(): void;
}

export interface PeerCallbacks {
  onIceCandidate(candidateJson: string): void;
  onConnected(): void;
  /** Mất kết nối không phục hồi được. */
  onFailed(): void;
}

export interface CallDeps {
  isOnline(): boolean;
  fetchIceServers(): Promise<IceServer[]>;
  initiate(): Promise<string>;
  accept(sessionId: string): Promise<void>;
  end(sessionId: string, reason: string): Promise<void>;
  /** Mở camera + micro và tạo peer. Camera phải được nhường trước (holdCamera). */
  createPeer(ice: IceServer[], callbacks: PeerCallbacks): Promise<CallPeer>;
  relayOffer(sessionId: string, sdp: string): Promise<void>;
  relayAnswer(sessionId: string, sdp: string): Promise<void>;
  relayIce(sessionId: string, candidateJson: string): Promise<void>;
  /** Tạm dừng camera dẫn đường (YOLO) để cuộc gọi dùng camera; chờ camera nhả xong. */
  holdCamera(): Promise<void>;
  releaseCamera(): void;
  speaker(on: boolean): void;
  say(text: string): void;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  ringTimeoutMs(): number;
  maxDurationMs(): number;
}

export interface IncomingCall {
  sessionId: string;
  callerName?: string | null;
  triggerType?: string | null;
}

export function createCallController(deps: CallDeps, onChange: (s: CallState) => void) {
  let state: CallState = { phase: 'idle', sessionId: null };
  let peer: CallPeer | null = null;
  let pendingIce: string[] = [];
  let offerSent = false;
  let remoteOffered = false;
  let generation = 0;
  let ringTimer: unknown = null;
  let durationTimer: unknown = null;

  const set = (next: CallState) => {
    state = next;
    onChange(state);
  };
  const isCurrent = (sessionId: string | undefined) =>
    !!sessionId && state.phase !== 'idle' && sessionId === state.sessionId;
  const clearTimers = () => {
    if (ringTimer !== null) deps.clearTimer(ringTimer);
    if (durationTimer !== null) deps.clearTimer(durationTimer);
    ringTimer = durationTimer = null;
  };

  /** Dọn sạch cuộc gọi: đóng peer, trả camera, tắt loa ngoài. Không gọi API. */
  const cleanup = (message: string | null) => {
    generation++;
    clearTimers();
    peer?.close();
    peer = null;
    pendingIce = [];
    offerSent = remoteOffered = false;
    const hadMedia = state.phase === 'connecting' || state.phase === 'connected';
    set({ phase: 'idle', sessionId: null });
    if (message) deps.say(message);
    if (hadMedia) {
      deps.speaker(false);
      deps.releaseCamera(); // sau câu kết thúc → "đã bật lại cảnh báo vật cản" đọc sau
    }
  };

  const fail = (e: unknown, message: string) => {
    logger.warn('Call failed', e);
    const sessionId = state.sessionId;
    cleanup(message);
    if (sessionId) void deps.end(sessionId, 'Failed').catch(() => undefined);
  };

  /** Nhường camera, tạo peer; chạy một lần cho mỗi cuộc gọi. */
  async function ensurePeer(gen: number): Promise<CallPeer | null> {
    if (peer) return peer;
    set({ phase: 'connecting', sessionId: state.sessionId });
    deps.say(Strings.call.connecting);
    const ice = await deps.fetchIceServers().catch(() => []);
    await deps.holdCamera();
    if (gen !== generation) return null;
    const sessionId = state.sessionId!;
    const created = await deps.createPeer(ice, {
      onIceCandidate: (c) =>
        void deps.relayIce(sessionId, c).catch((e: unknown) => logger.warn('Relay ICE failed', e)),
      onConnected: () => {
        if (gen !== generation || state.phase === 'connected') return;
        set({ phase: 'connected', sessionId });
        deps.speaker(true);
        deps.say(Strings.call.connected);
        durationTimer = deps.setTimer(
          () => void controller.hangUp(Strings.call.maxDuration),
          deps.maxDurationMs(),
        );
      },
      onFailed: () => {
        if (gen === generation) fail(new Error('ICE failed'), Strings.call.lost);
      },
    });
    if (gen !== generation) {
      created.close();
      return null;
    }
    peer = created;
    for (const c of pendingIce) await peer.addIceCandidate(c).catch(() => undefined);
    pendingIce = [];
    return peer;
  }

  /** VIU (`video_sender`) tạo offer — trừ khi phía kia đã gửi offer trước. */
  async function startMediaAndOffer(): Promise<void> {
    const gen = generation;
    try {
      const p = await ensurePeer(gen);
      if (!p || gen !== generation || remoteOffered || offerSent) return;
      offerSent = true;
      const sdp = await p.createOffer();
      if (gen !== generation) return;
      await deps.relayOffer(state.sessionId!, sdp);
    } catch (e) {
      if (gen === generation) fail(e, Strings.call.failed);
    }
  }

  const controller = {
    getState: () => state,

    /** Lệnh "gọi người chăm sóc". */
    async callCaregiver(): Promise<void> {
      if (state.phase !== 'idle') return deps.say(Strings.call.busy);
      if (!deps.isOnline()) return deps.say(Strings.call.needsNetwork);
      const gen = ++generation;
      set({ phase: 'outgoing', sessionId: null });
      deps.say(Strings.call.calling);
      try {
        const sessionId = await deps.initiate();
        if (gen !== generation) {
          void deps.end(sessionId, 'Cancelled').catch(() => undefined);
          return;
        }
        set({ phase: 'outgoing', sessionId });
        // Server tự chuyển Missed sau webrtc_ring_timeout_seconds; đồng hồ trên máy là dự phòng
        ringTimer = deps.setTimer(() => {
          if (gen !== generation) return;
          void deps.end(sessionId, 'Missed').catch(() => undefined);
          cleanup(Strings.call.noAnswer);
        }, deps.ringTimeoutMs() + 5000);
      } catch (e) {
        if (gen === generation) fail(e, Strings.call.failed);
      }
    },

    /** `WebRtcIncomingCall`: SOS tự động → chờ người chăm sóc nghe; người chăm sóc gọi → tự nhận. */
    async onIncoming(call: IncomingCall): Promise<void> {
      if (state.phase !== 'idle') return; // đang có cuộc gọi khác (server cũng chỉ mở một)
      const gen = ++generation;
      set({ phase: 'waiting', sessionId: call.sessionId });
      if (call.triggerType === 'SosAuto') {
        deps.say(Strings.call.sosWaiting);
        return;
      }
      deps.say(Strings.call.incoming(call.callerName?.trim() || null));
      try {
        await deps.accept(call.sessionId);
        if (gen !== generation) return;
        await startMediaAndOffer();
      } catch (e) {
        if (gen === generation) fail(e, Strings.call.failed);
      }
    },

    /** `WebRtcCallAccepted`: người chăm sóc đã nghe (cuộc gọi đi hoặc SOS) → mở camera, gửi offer. */
    async onAccepted(p: { sessionId?: string }): Promise<void> {
      if (!isCurrent(p.sessionId) || (state.phase !== 'outgoing' && state.phase !== 'waiting'))
        return;
      if (ringTimer !== null) deps.clearTimer(ringTimer);
      ringTimer = null;
      await startMediaAndOffer();
    },

    async onOffer(p: { sessionId?: string; sdp?: string }): Promise<void> {
      if (!isCurrent(p.sessionId) || !p.sdp || offerSent) return; // đã tự gửi offer → bỏ (tránh va chạm)
      remoteOffered = true;
      const gen = generation;
      try {
        const pc = await ensurePeer(gen);
        if (!pc || gen !== generation) return;
        const answer = await pc.acceptOffer(p.sdp);
        if (gen === generation) await deps.relayAnswer(state.sessionId!, answer);
      } catch (e) {
        if (gen === generation) fail(e, Strings.call.failed);
      }
    },

    async onAnswer(p: { sessionId?: string; sdp?: string }): Promise<void> {
      if (!isCurrent(p.sessionId) || !p.sdp || !peer) return;
      await peer.acceptAnswer(p.sdp).catch((e: unknown) => fail(e, Strings.call.failed));
    },

    async onIceCandidate(p: { sessionId?: string; candidateJson?: string }): Promise<void> {
      if (!isCurrent(p.sessionId) || !p.candidateJson) return;
      if (!peer) {
        pendingIce.push(p.candidateJson); // đến trước khi peer sẵn sàng
        return;
      }
      await peer
        .addIceCandidate(p.candidateJson)
        .catch((e: unknown) => logger.warn('Add ICE failed', e));
    },

    /** `WebRtcCallEnded` / `WebRtcCallRejected`. */
    onEnded(p: { sessionId?: string; reason?: string | null }, rejected = false): void {
      if (!isCurrent(p.sessionId)) return;
      const message = rejected
        ? Strings.call.rejected
        : p.reason === 'Missed'
          ? Strings.call.noAnswer
          : Strings.call.ended;
      cleanup(message);
    },

    /** Người dùng kết thúc (phím âm lượng, nút, lệnh) hoặc hết thời lượng tối đa. */
    async hangUp(message: string = Strings.call.ended): Promise<boolean> {
      if (state.phase === 'idle') return false;
      const sessionId = state.sessionId;
      cleanup(message);
      if (sessionId)
        await deps
          .end(sessionId, 'UserEnded')
          .catch((e: unknown) => logger.warn('End call failed', e));
      return true;
    },
  };
  return controller;
}

export type CallController = ReturnType<typeof createCallController>;
