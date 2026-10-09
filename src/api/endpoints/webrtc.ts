import { z } from 'zod';

import { apiClient } from '../client';
import { apiResponseSchema } from '../types';

export interface IceServer {
  urls: string;
  username?: string;
  credential?: string;
}

const iceSchema = z.object({
  urls: z.string(),
  username: z.string().nullable().optional(),
  credential: z.string().nullable().optional(),
});
const toIce = (s: z.infer<typeof iceSchema>): IceServer => ({
  urls: s.urls,
  ...(s.username ? { username: s.username } : {}),
  ...(s.credential ? { credential: s.credential } : {}),
});

/** STUN Google + TURN Coturn do server cấp — dùng cho mọi loại cuộc gọi (§9.10). */
export async function fetchIceServers(): Promise<IceServer[]> {
  const res = await apiClient.get('/api/webrtc/ice-servers/public');
  return apiResponseSchema(z.object({ iceServers: z.array(iceSchema) }))
    .parse(res.data)
    .data.iceServers.map(toIce);
}

/** VIU gọi người chăm sóc chính (`VIU_VOICE_COMMAND`). */
export async function initiateCall(): Promise<string> {
  const res = await apiClient.post('/api/webrtc/sessions', { triggerType: 'ViuVoiceCommand' });
  return apiResponseSchema(z.object({ sessionId: z.string() })).parse(res.data).data.sessionId;
}

/** Nhận cuộc gọi người chăm sóc gọi tới (VIU là receiver). */
export async function acceptCall(sessionId: string): Promise<void> {
  await apiClient.post(`/api/webrtc/sessions/${sessionId}/accept`);
}

export async function endCall(sessionId: string, reason: string): Promise<void> {
  await apiClient.post(`/api/webrtc/sessions/${sessionId}/end`, { reason });
}
