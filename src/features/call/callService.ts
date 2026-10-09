import { useSyncExternalStore } from 'react';

import { acceptCall, endCall, fetchIceServers, initiateCall } from '@/api/endpoints/webrtc';
import { Strings } from '@/constants/strings.vi';
import { configNumber } from '@/services/config/runtimeConfig';
import { HapticService } from '@/services/haptics/HapticService';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import { locationHub, type WebRtcEvent } from '@/services/signalr/LocationHubClient';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { createWebRtcPeer } from '@/services/webrtc/webrtcPeer';
import { logger } from '@/utils/logger';

import { setSpeakerphone } from '../../../modules/volume-key';

import { cameraHold } from './cameraHold';
import { createCallController, type CallState } from './callController';

let state: CallState = { phase: 'idle', sessionId: null };
const listeners = new Set<() => void>();
/** Camera dẫn đường đang chạy lúc bắt đầu gọi → hết gọi báo "đã bật lại cảnh báo vật cản". */
let resumeNavigationNotice = false;

const controller = createCallController(
  {
    isOnline: () => NetworkMonitor.isOnline(),
    fetchIceServers,
    initiate: initiateCall,
    accept: acceptCall,
    end: endCall,
    createPeer: createWebRtcPeer,
    relayOffer: (id, sdp) => locationHub.invoke('RelayOffer', id, sdp),
    relayAnswer: (id, sdp) => locationHub.invoke('RelayAnswer', id, sdp),
    relayIce: (id, c) => locationHub.invoke('RelayIceCandidate', id, c),
    holdCamera: async () => {
      resumeNavigationNotice = await cameraHold.hold();
    },
    releaseCamera: () => {
      cameraHold.release();
      if (resumeNavigationNotice) {
        resumeNavigationNotice = false;
        ttsService.enqueue({ text: Strings.call.resumed, priority: TtsPriority.SYSTEM });
      }
    },
    speaker: (on) => setSpeakerphone(on),
    // Thông báo cuộc gọi quan trọng như cảnh báo hệ thống, kèm rung
    say: (text) => {
      ttsService.enqueue({ text, priority: TtsPriority.SYSTEM });
      void HapticService.warning();
    },
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    ringTimeoutMs: () => configNumber('webrtc_ring_timeout_seconds', 45) * 1000,
    maxDurationMs: () => configNumber('webrtc_max_duration_minutes', 60) * 60_000,
  },
  (next) => {
    state = next;
    listeners.forEach((l) => l());
  },
);

const asRecord = (p: unknown): Record<string, unknown> =>
  typeof p === 'object' && p !== null ? (p as Record<string, unknown>) : {};
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** Nghe signaling WebRTC từ hub (gọi khi vào app sau đăng nhập). Trả hàm dừng. */
export function startCallSignaling(): () => void {
  const on = (event: WebRtcEvent, handle: (p: Record<string, unknown>) => unknown) =>
    locationHub.subscribe(event, (payload) => {
      Promise.resolve(handle(asRecord(payload))).catch((e: unknown) =>
        logger.warn(`Handle ${event} failed`, e),
      );
    });
  const subs = [
    on('WebRtcIncomingCall', (p) =>
      controller.onIncoming({
        sessionId: str(p.sessionId) ?? '',
        callerName: str(p.callerName),
        triggerType: str(p.triggerType),
      }),
    ),
    on('WebRtcCallAccepted', (p) => controller.onAccepted({ sessionId: str(p.sessionId) })),
    on('WebRtcOffer', (p) => controller.onOffer({ sessionId: str(p.sessionId), sdp: str(p.sdp) })),
    on('WebRtcAnswer', (p) =>
      controller.onAnswer({ sessionId: str(p.sessionId), sdp: str(p.sdp) }),
    ),
    on('WebRtcIceCandidate', (p) =>
      controller.onIceCandidate({
        sessionId: str(p.sessionId),
        candidateJson: str(p.candidateJson),
      }),
    ),
    on('WebRtcCallEnded', (p) =>
      controller.onEnded({ sessionId: str(p.sessionId), reason: str(p.reason) }),
    ),
    on('WebRtcCallRejected', (p) => controller.onEnded({ sessionId: str(p.sessionId) }, true)),
  ];
  return () => {
    subs.forEach((off) => off());
    void controller.hangUp(); // đăng xuất / rời app khi đang gọi
  };
}

export const callService = {
  callCaregiver: () => controller.callCaregiver(),
  /** false nếu không có cuộc gọi. */
  hangUp: () => controller.hangUp(),
  isActive: () => state.phase !== 'idle',
};

export function useCallState(): CallState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
