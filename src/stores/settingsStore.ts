import { create } from 'zustand';

import type { DetectionMode } from '@/constants/enums';

// TODO(Sprint 7/8): đồng bộ detectionMode với /users/me/tts-preferences; pin < 10% → Minimal (BR-17).
interface SettingsState {
  detectionMode: DetectionMode;
  setDetectionMode: (mode: DetectionMode) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  detectionMode: 'Full',
  setDetectionMode: (detectionMode) => set({ detectionMode }),
}));
