import type { CommandStatus, RecognitionEngine } from '@/constants/enums';

import { apiClient } from '../client';

/** Khớp `LogVoiceCommandRequest` của backend (POST /api/voice-commands, chỉ role VIU). */
export interface VoiceCommandLog {
  rawTranscript: string | null;
  matchedCommand: string | null;
  recognitionEngine: RecognitionEngine;
  confidenceScore: number | null;
  executionStatus: CommandStatus;
  requiredConfirmation: boolean;
  /** Bắt buộc khi `Confirmed`, phải ≥ `executedAt`. */
  confirmedAt: string | null;
  processingTimeMs: number | null;
  isOffline: boolean;
  executedAt: string;
  latitude: number | null;
  longitude: number | null;
}

export async function logVoiceCommand(log: VoiceCommandLog): Promise<void> {
  await apiClient.post('/api/voice-commands', log);
}
