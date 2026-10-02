import { VoiceCommands } from '@/constants/voiceCommands';
import type { ListenOutcome } from '@/services/speech/SpeechService';
import { enqueue } from '@/services/storage/offlineQueue';
import { syncOfflineNow } from '@/features/sync/offlineSync';

import { recordVoiceCommand, toVoiceLog } from './voiceLog';

jest.mock('@/services/storage/offlineQueue', () => ({ enqueue: jest.fn(async () => {}) }));
jest.mock('@/features/sync/offlineSync', () => ({ syncOfflineNow: jest.fn() }));

const outcome = (over: Partial<ListenOutcome> = {}): ListenOutcome => ({
  engine: 'GoogleSpeech',
  alternatives: [{ transcript: 'bắt đầu', confidence: 0.94 }],
  discardedAsEcho: false,
  isOffline: false,
  processingTimeMs: 2300,
  ...over,
});
const command = (intent: string) => VoiceCommands.find((c) => c.intent === intent) ?? null;
const at = new Date('2026-10-02T10:00:00.000Z');

describe('toVoiceLog (khớp LogVoiceCommandValidator của backend)', () => {
  it('lệnh thường thành công', () => {
    expect(
      toVoiceLog({
        outcome: outcome(),
        command: command('START_NAVIGATION'),
        status: 'Success',
        executedAt: at,
      }),
    ).toEqual({
      rawTranscript: 'bắt đầu',
      matchedCommand: 'START_NAVIGATION',
      recognitionEngine: 'GoogleSpeech',
      confidenceScore: 0.94,
      executionStatus: 'Success',
      requiredConfirmation: false,
      confirmedAt: null,
      processingTimeMs: 2300,
      isOffline: false,
      executedAt: '2026-10-02T10:00:00.000Z',
      latitude: null,
      longitude: null,
    });
  });

  it('Confirmed → có confirmedAt ≥ executedAt', () => {
    const confirmedAt = new Date('2026-10-02T10:00:05.000Z');
    const log = toVoiceLog({
      outcome: outcome(),
      command: command('EMERGENCY'),
      status: 'Confirmed',
      executedAt: at,
      confirmedAt,
    });
    expect(log).toMatchObject({
      requiredConfirmation: true,
      confirmedAt: confirmedAt.toISOString(),
    });
  });

  it('Google trên máy: confidence 0 (không có) → null; transcript cắt còn 500 ký tự', () => {
    const log = toVoiceLog({
      outcome: outcome({
        engine: 'GoogleOnDevice',
        isOffline: true,
        alternatives: [{ transcript: 'a'.repeat(600), confidence: 0 }],
        processingTimeMs: 0,
      }),
      command: null,
      status: 'Unrecognized',
      executedAt: at,
    });
    expect(log).toMatchObject({
      confidenceScore: null,
      processingTimeMs: null, // backend yêu cầu > 0
      matchedCommand: null,
      isOffline: true,
      recognitionEngine: 'GoogleOnDevice',
    });
    expect(log.rawTranscript).toHaveLength(500);
  });
});

describe('recordVoiceCommand', () => {
  it('ghi vào hàng đợi "voice" rồi đồng bộ', async () => {
    const log = toVoiceLog({
      outcome: outcome(),
      command: null,
      status: 'Unrecognized',
      executedAt: at,
    });
    recordVoiceCommand(log);
    await Promise.resolve();
    await Promise.resolve();
    expect(enqueue).toHaveBeenCalledWith('voice', log);
    expect(syncOfflineNow).toHaveBeenCalled();
  });
});
