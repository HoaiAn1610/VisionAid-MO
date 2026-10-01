import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { apiClient } from '../client';
import { endSession, logDetectionEvents, startSession } from './navigation';

jest.mock('@/services/storage/secureStorage', () => ({
  getTokens: jest.fn(async () => null),
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
  getOrCreateClientDeviceId: jest.fn(async () => 'device-1'),
}));

let last: InternalAxiosRequestConfig | undefined;
function reply(data: unknown) {
  apiClient.defaults.adapter = async (config): Promise<AxiosResponse> => {
    last = config;
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
}
const body = () => JSON.parse(last?.data as string) as unknown;
const ok = (data: unknown) => ({ success: true, message: 'Success', data, errors: [] });

describe('navigation endpoints — khớp backend Navigation module', () => {
  it('startSession gửi detectionMode + startedAt gốc, trả id server', async () => {
    reply(ok({ id: 'S1', isActive: true }));
    const id = await startSession({
      localId: 'L1',
      serverId: null,
      detectionMode: 'Minimal',
      startedAt: '2026-09-28T01:00:00.000Z',
      endedAt: null,
    });
    expect(id).toBe('S1');
    expect([last?.method, last?.url]).toEqual(['post', '/api/navigation/sessions']);
    expect(body()).toMatchObject({
      detectionMode: 'Minimal',
      startedAt: '2026-09-28T01:00:00.000Z',
    });
  });

  it('logDetectionEvents gửi MẢNG payload lên endpoint batch', async () => {
    reply(ok({}));
    const payload = {
      objectClass: 'car',
      confidenceScore: 0.9,
      distanceRange: 'Near' as const,
      alertIssued: true,
      detectedAt: '2026-09-28T01:00:01.000Z',
    };
    await logDetectionEvents('S1', [{ id: 'e1', localSessionId: 'L1', payload }]);
    expect(last?.url).toBe('/api/navigation/sessions/S1/events/batch');
    expect(body()).toEqual([payload]);
  });

  it('endSession PATCH kèm endedAt', async () => {
    reply(ok({}));
    await endSession('S1', '2026-09-28T01:10:00.000Z');
    expect([last?.method, last?.url, body()]).toEqual([
      'patch',
      '/api/navigation/sessions/S1/end',
      { endedAt: '2026-09-28T01:10:00.000Z' },
    ]);
  });
});
