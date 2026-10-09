import {
  mediaDevices,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';

import type { IceServer } from '@/api/endpoints/webrtc';
import type { CallPeer, PeerCallbacks } from '@/features/call/callController';

/** Video nhẹ cho mạng di động — người chăm sóc chỉ cần nhìn được đường phía trước. */
const VIDEO = { facingMode: 'environment', width: 640, height: 480, frameRate: 15 } as const;

/**
 * Peer WebRTC phía VIU (`video_sender`): gửi camera sau + micro, chỉ nhận tiếng người chăm sóc.
 * SDP gửi dạng chuỗi; ICE candidate gửi dạng JSON `{ candidate, sdpMid, sdpMLineIndex }`.
 */
export async function createWebRtcPeer(
  iceServers: IceServer[],
  callbacks: PeerCallbacks,
): Promise<CallPeer> {
  const stream = await mediaDevices.getUserMedia({ audio: true, video: VIDEO });
  const pc = new RTCPeerConnection({ iceServers });
  for (const track of stream.getTracks()) pc.addTrack(track, stream);

  // Typings của thư viện chỉ khai báo `on…` (không có addEventListener); event chưa có kiểu candidate
  pc.onicecandidate = (event: unknown) => {
    const c = (event as { candidate: RTCIceCandidate | null }).candidate;
    if (c) {
      callbacks.onIceCandidate(
        JSON.stringify({
          candidate: c.candidate,
          sdpMid: c.sdpMid,
          sdpMLineIndex: c.sdpMLineIndex,
        }),
      );
    }
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') callbacks.onConnected();
    else if (pc.connectionState === 'failed') callbacks.onFailed();
  };

  return {
    async createOffer() {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);
      return offer.sdp ?? '';
    },
    async acceptOffer(sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer.sdp ?? '';
    },
    async acceptAnswer(sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
    },
    async addIceCandidate(candidateJson) {
      await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidateJson)));
    },
    close() {
      for (const track of stream.getTracks()) track.stop();
      stream.release();
      pc.close();
    },
  };
}
