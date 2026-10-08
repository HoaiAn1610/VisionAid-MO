import { fetchTtsPreferences, saveTtsPreferences } from '@/api/endpoints/users';
import { getCachedPreferences, saveCachedPreferences } from '@/services/storage/secureStorage';
import { ttsService } from '@/services/tts/TtsService';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

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
