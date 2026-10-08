import { fetchTtsPreferences, saveTtsPreferences } from '@/api/endpoints/users';
import { getCachedPreferences, saveCachedPreferences } from '@/services/storage/secureStorage';
import { ttsService } from '@/services/tts/TtsService';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

import type { DetectionMode } from '@/constants/enums';

import { createPreferences } from './preferences';

/** Tùy chọn đọc / chế độ của người dùng — dùng chung cho màn Cài đặt và lệnh giọng nói. */
export const preferences = createPreferences({
  userId: () => useAuthStore.getState().user?.id ?? null,
  readCache: getCachedPreferences,
  writeCache: saveCachedPreferences,
  fetchRemote: fetchTtsPreferences,
  pushRemote: saveTtsPreferences,
  apply: (p) => {
    ttsService.updateSettings({ rate: p.speedRate, volume: p.volumeLevel });
    useSettingsStore.getState().setDetectionMode(p.detectionMode);
  },
});

/** Người dùng TỰ chọn chế độ (màn Cài đặt, lệnh giọng nói) → bỏ chế độ tiết kiệm pin đang ép. */
export function chooseDetectionMode(detectionMode: DetectionMode): Promise<'saved' | 'local'> {
  useSettingsStore.getState().setBatterySaver(false);
  return preferences.update({ detectionMode });
}
