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
 * Hub `/hubs/location` (§11): VIU CHỈ NHẬN `ArrivalNotification` — hub không có method cho client
 * gọi, GPS luôn gửi qua REST. Server tự đưa VIU vào nhóm `viu_{userId}` theo JWT.
 */
class LocationHubClientImpl {
  private connection: HubConnection | null = null;
  private starting: Promise<void> | null = null;

  start(onArrival: (n: ArrivalNotification) => void): void {
    if (this.connection) return;
    const connection = new HubConnectionBuilder()
      .withUrl(Env.signalRUrl, {
        // WebSocket gửi token qua query `access_token` (backend đọc ở OnMessageReceived)
        accessTokenFactory: async () => (await getTokens())?.accessToken ?? '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();
    connection.on('ArrivalNotification', onArrival);
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
