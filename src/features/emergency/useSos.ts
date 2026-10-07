import { useCallback, useEffect, useRef, useState } from 'react';

import { createEmergencyEvent } from '@/api/endpoints/emergency';
import type { DetectionMethod } from '@/constants/enums';
import { Strings } from '@/constants/strings.vi';
import { syncOfflineNow } from '@/features/sync/offlineSync';
import { confirmByVoice, type VoiceConfirmation } from '@/features/voice-commands/confirmByVoice';
import { HapticService } from '@/services/haptics/HapticService';
import { getQuickPosition } from '@/services/location/gps';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import { readEmergencyContacts } from '@/services/storage/emergencyContactsRepo';
import { enqueue } from '@/services/storage/offlineQueue';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { useAuthStore } from '@/stores/authStore';

import { ensureCallPermission, executeCall } from './callContact';
import { sendSos, type SosDeps } from './sos';

/** Chờ TTS đọc xong (tối đa vài giây) trước khi rời app sang cuộc gọi. */
const MAX_ANNOUNCE_WAIT_MS = 8000;

/**
 * Đọc câu rồi chờ đọc XONG. Đăng ký nghe trước khi enqueue: câu EMERGENCY ngắt câu đang đọc làm
 * `isSpeaking()` thoáng về false — nếu kiểm tra ngay sau enqueue sẽ tưởng đã đọc xong và gọi điện luôn.
 */
function announce(text: string): Promise<void> {
  return new Promise((resolve) => {
    let started = false;
    const done = () => {
      clearTimeout(timer);
      off();
      resolve();
    };
    const timer = setTimeout(done, MAX_ANNOUNCE_WAIT_MS);
    const off = ttsService.onSpeakingChange((speaking) => {
      if (speaking) started = true;
      else if (started) done();
    });
    ttsService.enqueue({ text, priority: TtsPriority.EMERGENCY });
    if (ttsService.isSpeaking()) started = true;
  });
}

const deps: SosDeps = {
  isOnline: () => NetworkMonitor.isOnline(),
  position: getQuickPosition,
  createEvent: createEmergencyEvent,
  enqueue: async (payload) => {
    await enqueue('emergency', payload, useAuthStore.getState().user?.id ?? null);
    syncOfflineNow();
  },
  contacts: readEmergencyContacts,
  announce,
  call: executeCall,
  now: Date.now,
};

export type SosPhase = 'idle' | 'confirming' | 'sending' | 'done';

/**
 * Màn khẩn cấp (FE-10, BR-14): chạm "Gọi khẩn cấp" → xác nhận (nói "đồng ý" hoặc chạm "Xác nhận
 * gửi", 10 s) → gửi + gọi người thân. Lệnh giọng nói "gọi khẩn cấp" đã xác nhận trước → gửi ngay.
 */
export function useSos(alreadyConfirmedByVoice: boolean) {
  const [phase, setPhase] = useState<SosPhase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const confirmation = useRef<VoiceConfirmation | null>(null);
  const busy = useRef(false);

  const send = useCallback(async (method: DetectionMethod) => {
    if (busy.current) return;
    busy.current = true;
    setPhase('sending');
    try {
      const { sent } = await sendSos(method, deps);
      void HapticService.sosSent();
      setMessage(sent ? Strings.emergency.sent : Strings.emergency.queued);
    } finally {
      busy.current = false;
      setPhase('done');
    }
  }, []);

  const start = useCallback(async () => {
    if (busy.current || confirmation.current) return;
    setPhase('confirming');
    const c = confirmByVoice(Strings.voice.confirmEmergency, Strings.voice.emergencyCancelled);
    confirmation.current = c;
    const confirmedAt = await c.result;
    if (confirmation.current !== c) return; // đã xác nhận / hủy bằng nút
    confirmation.current = null;
    if (confirmedAt) void send('Manual');
    else setPhase('idle');
  }, [send]);

  /** Chạm "Xác nhận gửi": dừng câu hỏi (im lặng) rồi gửi ngay. */
  const confirm = useCallback(() => {
    confirmation.current?.cancel(true);
    confirmation.current = null;
    void send('Manual');
  }, [send]);

  /** Chạm "Hủy": dừng câu hỏi, đọc "đã hủy gọi khẩn cấp". */
  const cancel = useCallback(() => {
    confirmation.current?.cancel();
    confirmation.current = null;
    setPhase('idle');
  }, []);

  useEffect(() => {
    if (alreadyConfirmedByVoice) void send('VoiceCommand');
    else {
      ttsService.enqueue({ text: Strings.emergency.intro, priority: TtsPriority.SYSTEM });
      void ensureCallPermission(); // xin trước, để lúc khẩn cấp không phải hỏi
    }
    return () => confirmation.current?.cancel(true);
    // Chỉ chạy khi mở màn hình
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { phase, message, start, confirm, cancel };
}
