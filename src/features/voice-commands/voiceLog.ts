import type { VoiceCommandLog } from '@/api/endpoints/voice';
import type { CommandStatus } from '@/constants/enums';
import type { VoiceCommandDef } from '@/constants/voiceCommands';
import { syncOfflineNow } from '@/features/sync/offlineSync';
import type { ListenOutcome } from '@/services/speech/SpeechService';
import { enqueue } from '@/services/storage/offlineQueue';
import { logger } from '@/utils/logger';

/** Giới hạn của backend (LogVoiceCommandValidator). */
const MAX_TRANSCRIPT = 500;

interface TurnResult {
  outcome: ListenOutcome;
  command: VoiceCommandDef | null;
  status: CommandStatus;
  /** Lúc nghe xong câu lệnh. */
  executedAt: Date;
  confirmedAt?: Date;
}

/** Một lượt ra lệnh → bản ghi `voice_command_logs` đúng ràng buộc backend. */
export function toVoiceLog({
  outcome,
  command,
  status,
  executedAt,
  confirmedAt,
}: TurnResult): VoiceCommandLog {
  const top = outcome.alternatives[0];
  return {
    rawTranscript: top?.transcript.slice(0, MAX_TRANSCRIPT) ?? null,
    matchedCommand: command?.intent ?? null,
    recognitionEngine: outcome.engine,
    // Google trên máy trả 0 = không có confidence → gửi null, không gửi 0 (không phải "chắc 0%")
    confidenceScore: top?.confidence !== undefined && top.confidence > 0 ? top.confidence : null,
    executionStatus: status,
    requiredConfirmation: command?.requiresConfirmation ?? false,
    confirmedAt: status === 'Confirmed' ? (confirmedAt ?? executedAt).toISOString() : null,
    processingTimeMs: outcome.processingTimeMs > 0 ? Math.round(outcome.processingTimeMs) : null,
    isOffline: outcome.isOffline,
    executedAt: executedAt.toISOString(),
    // TODO(Sprint 6): gắn vị trí GPS gần nhất
    latitude: null,
    longitude: null,
  };
}

/** Ghi vào hàng đợi offline rồi đồng bộ nếu có mạng (§13). Lỗi không ảnh hưởng lượt ra lệnh. */
export function recordVoiceCommand(log: VoiceCommandLog): void {
  enqueue('voice', log)
    .then(syncOfflineNow)
    .catch((e: unknown) => logger.warn('Record voice command failed', e));
}
