import {
  HttpError,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from '@microsoft/signalr';

import { refreshSingleFlight } from '@/api/client';
import { Env } from '@/config/env';
import type { ArrivalNotification } from '@/features/location/arrivalNotice';
import { getTokens } from '@/services/storage/secureStorage';
import { logger } from '@/utils/logger';

/**
 * Token còn dưới 30 s (hoặc không đọc được hạn) → cần làm mới. Chỉ đọc `exp` để quyết định có refresh
 * không — không dùng để xác thực.
 */
export function isTokenExpiring(token: string, nowMs: number): boolean {
  try {
    const payload = (token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload)) as { exp?: number };
    return typeof exp !== 'number' || exp * 1000 - nowMs < 30_000;
  } catch {
    return true;
  }
}

/** Token cho mỗi lần (kết nối lại) hub. Auto-reconnect không qua interceptor axios → tự refresh. */
async function freshAccessToken(): Promise<string> {
  const token = (await getTokens())?.accessToken;
  if (!token) return '';
  if (!isTokenExpiring(token, Date.now())) return token;
  return (await refreshSingleFlight().catch(() => null)) ?? token;
}

/** Event WebRTC server đẩy cho VIU (§9.10). Payload JSON camelCase. */
export const WEBRTC_EVENTS = [
  'WebRtcIncomingCall',
  'WebRtcCallAccepted',
  'WebRtcOffer',
  'WebRtcAnswer',
  'WebRtcIceCandidate',
  'WebRtcCallEnded',
  'WebRtcCallRejected',
] as const;
export type WebRtcEvent = (typeof WEBRTC_EVENTS)[number];

/**
 * Hub `/hubs/location` (§11): VIU nhận `ArrivalNotification` và signaling WebRTC; gọi lên hub chỉ
 * để relay SDP / ICE. GPS luôn gửi qua REST. Server tự đưa VIU vào nhóm `viu_{userId}` theo JWT.
 */
class LocationHubClientImpl {
  private connection: HubConnection | null = null;
  private starting: Promise<void> | null = null;
  private readonly listeners = new Map<WebRtcEvent, Set<(payload: unknown) => void>>();

  /** Nghe một event WebRTC (đăng ký trước hay sau `start` đều được). Trả hàm hủy. */
  subscribe(event: WebRtcEvent, listener: (payload: unknown) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(listener);
    return () => set.delete(listener);
  }

  /** Gọi method của hub (RelayOffer / RelayAnswer / RelayIceCandidate). Chưa kết nối → ném lỗi. */
  async invoke(method: string, ...args: unknown[]): Promise<void> {
    const connection = this.connection;
    if (!connection) throw new Error('SignalR not started');
    await this.ensureConnected();
    await connection.invoke(method, ...args);
  }

  start(onArrival: (n: ArrivalNotification) => void): void {
    if (this.connection) return;
    const connection = new HubConnectionBuilder()
      .withUrl(Env.signalRUrl, {
        // WebSocket gửi token qua query `access_token` (backend đọc ở OnMessageReceived)
        accessTokenFactory: freshAccessToken,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();
    connection.on('ArrivalNotification', onArrival);
    for (const event of WEBRTC_EVENTS) {
      connection.on(event, (payload: unknown) => {
        for (const listener of this.listeners.get(event) ?? []) listener(payload);
      });
    }
    this.connection = connection;
    void this.ensureConnected();
  }

  /** Gọi khi app về foreground / có mạng lại: tự kết nối lại nếu auto-reconnect đã bỏ cuộc. */
  ensureConnected(): Promise<void> {
    const connection = this.connection;
    if (!connection || connection.state !== HubConnectionState.Disconnected) {
      return Promise.resolve();
    }
    this.starting ??= this.connect(connection).finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  async stop(): Promise<void> {
    const connection = this.connection;
    this.connection = null;
    await connection?.stop().catch((e: unknown) => logger.warn('SignalR stop failed', e));
  }

  private async connect(connection: HubConnection): Promise<void> {
    try {
      await connection.start();
    } catch (e) {
      // Access token hết hạn → làm mới qua cùng single-flight của axios rồi thử lại một lần
      if (!(e instanceof HttpError && e.statusCode === 401)) {
        logger.warn('SignalR connect failed', e);
        return;
      }
      const refreshed = await refreshSingleFlight().catch(() => null);
      if (!refreshed || this.connection !== connection) return;
      await connection.start().catch((err: unknown) => logger.warn('SignalR connect failed', err));
    }
  }
}

export const locationHub = new LocationHubClientImpl();
