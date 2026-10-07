import * as Crypto from 'expo-crypto';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

import { createEmergencyEvent, dismissEmergencyEvent } from '@/api/endpoints/emergency';
import { Strings } from '@/constants/strings.vi';
import { matchIntent } from '@/features/voice-commands/intentMatcher';
import { syncOfflineNow } from '@/features/sync/offlineSync';
import { HapticService } from '@/services/haptics/HapticService';
import { getQuickPosition } from '@/services/location/gps';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import { speechService } from '@/services/speech/SpeechService';
import { readEmergencyContacts } from '@/services/storage/emergencyContactsRepo';
import { enqueue } from '@/services/storage/offlineQueue';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';

import { executeCall } from './callContact';
import { createFallAlert, type FallAlertState } from './fallAlert';
import type { FallEvent } from './fallDetector';

let state: FallAlertState = { phase: 'idle', remaining: 0 };

// TalkBack bật → chạm một lần chỉ chọn lớp phủ, phải chạm hai lần mới hủy
let screenReaderOn = false;
AccessibilityInfo.isScreenReaderEnabled()
  .then((on) => (screenReaderOn = on))
  .catch(() => undefined);
AccessibilityInfo.addEventListener('screenReaderChanged', (on) => (screenReaderOn = on));
const listeners = new Set<() => void>();

const controller = createFallAlert(
  {
    isOnline: () => NetworkMonitor.isOnline(),
    position: getQuickPosition,
    createEvent: createEmergencyEvent,
    dismissEvent: (id) => dismissEmergencyEvent(id),
    enqueue: async (payload) => {
      await enqueue('emergency', payload, useAuthStore.getState().user?.id ?? null);
      syncOfflineNow();
    },
    contacts: readEmergencyContacts,
    call: executeCall,
    say: (text) => ttsService.enqueue({ text, priority: TtsPriority.EMERGENCY }),
    tick: () => void HapticService.countdownTick(),
    sentHaptic: () => void HapticService.sosSent(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    now: Date.now,
    newId: () => Crypto.randomUUID(),
    detectedMessage: () =>
      screenReaderOn ? Strings.fall.detectedScreenReader : Strings.fall.detected,
  },
  (next) => {
    // Đã gửi / đã hủy → đóng mic đang nghe "tôi ổn"
    if (state.phase === 'countdown' && next.phase !== 'countdown') speechService.abort();
    state = next;
    listeners.forEach((l) => l());
  },
);

/**
 * Nghe "tôi ổn" trong lúc đếm ngược. SpeechService chỉ mở mic khi TTS im và bỏ mọi câu nghe được
 * lúc TTS đang đọc — câu "Phát hiện té ngã. Nói tôi ổn…" không thể tự hủy cảnh báo (§9.7).
 */
async function listenForImOk(): Promise<void> {
  while (controller.getState().phase === 'countdown') {
    const outcome = await speechService.listenOnce().catch((e: unknown) => {
      logger.warn('Listen for "tôi ổn" failed', e);
      return null;
    });
    if (controller.getState().phase !== 'countdown') return;
    if (!outcome) return; // không nghe được (offline, thiếu quyền) → chạm màn hình là cách hủy chính
    if (matchIntent(outcome.alternatives)?.intent === 'I_AM_OK') {
      await controller.cancel();
      return;
    }
  }
}

export const fallAlert = {
  /** Gọi từ phiên dẫn đường khi FallDetector báo té ngã. */
  trigger(event: FallEvent): void {
    if (controller.getState().phase === 'countdown') return;
    controller.reset();
    void controller.start(event).then(listenForImOk);
  },
  /** Chạm màn hình / lệnh "tôi ổn". Trả false nếu không có cảnh báo nào đang đếm ngược. */
  cancel(): boolean {
    if (controller.getState().phase !== 'countdown') return false;
    speechService.abort();
    void controller.cancel();
    return true;
  },
};

export const isFallAlertActive = (): boolean => state.phase === 'countdown';

export function useFallAlertState(): FallAlertState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
