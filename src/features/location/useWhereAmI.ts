import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchMyLocation, recordGps } from '@/api/endpoints/locations';
import { Strings } from '@/constants/strings.vi';
import { say } from '@/features/capture/useCaptureAndSpeak';
import { SLOW_NOTICE_MS } from '@/features/ocr/readText';
import { useVoice } from '@/features/voice-commands/VoiceProvider';
import { ensureLocationPermission, getCurrentPoint } from '@/services/location/gps';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import { readCachedLocation, saveCachedLocation } from '@/services/storage/locationCache';
import { logger } from '@/utils/logger';

import { describeWhereAmI, whereAmI, type WhereAmIDeps } from './whereAmI';

const deps: WhereAmIDeps = {
  isOnline: () => NetworkMonitor.isOnline(),
  currentPoint: getCurrentPoint,
  recordGps,
  fetchMyLocation,
  readCache: readCachedLocation,
  saveCache: saveCachedLocation,
  now: Date.now,
};

/** Mở màn hình là hỏi vị trí ngay; "Hỏi lại" để xác định lại. Không có quyền vẫn đọc cache. */
export function useWhereAmI() {
  const { listen, registerScreenAction } = useVoice();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);

  const ask = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    const slow = setTimeout(() => say(Strings.location.locating), SLOW_NOTICE_MS);
    let spoken: string;
    try {
      await ensureLocationPermission();
      spoken = describeWhereAmI(await whereAmI(deps));
    } catch (e) {
      logger.warn('Where am I failed', e);
      spoken = Strings.errors.unavailable;
    } finally {
      clearTimeout(slow);
      running.current = false;
    }
    if (!mounted.current) return;
    setBusy(false);
    setMessage(spoken);
    say(spoken);
    listen('follow-up');
  }, [listen]);

  useEffect(() => {
    registerScreenAction('/location', () => void ask());
    return () => registerScreenAction('/location', null);
  }, [registerScreenAction, ask]);

  useEffect(() => {
    void ask();
    return () => {
      mounted.current = false;
    };
    // Chỉ hỏi một lần khi mở màn hình
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { message, busy, ask };
}
