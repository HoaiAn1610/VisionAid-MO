import { create } from 'zustand';

import type { DetectionMode } from '@/constants/enums';

// Lưu + đồng bộ server qua features/settings/preferencesService; pin < 10% đặt Minimal tạm thời (không lưu).
interface SettingsState {
  detectionMode: DetectionMode;
  setDetectionMode: (mode: DetectionMode) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  detectionMode: 'Full',
  setDetectionMode: (detectionMode) => set({ detectionMode }),
}));
