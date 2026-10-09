import { create } from 'zustand';

import type { DetectionMode } from '@/constants/enums';

interface SettingsState {
  /** Lựa chọn của người dùng — lưu + đồng bộ server qua features/settings/preferencesService. */
  detectionMode: DetectionMode;
  setDetectionMode: (mode: DetectionMode) => void;
  /**
   * Pin < 10% (BR-17): ép Tối giản TẠM THỜI, tách khỏi lựa chọn của người dùng → tải tùy chọn từ
   * máy / server không ghi đè được. Tắt khi sạc lên trên ngưỡng hoặc người dùng tự chọn chế độ.
   */
  batterySaver: boolean;
  setBatterySaver: (on: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  detectionMode: 'Full',
  setDetectionMode: (detectionMode) => set({ detectionMode }),
  batterySaver: false,
  setBatterySaver: (batterySaver) => set({ batterySaver }),
}));

/** Chế độ thực sự áp dụng khi dẫn đường. */
export const selectEffectiveMode = (s: SettingsState): DetectionMode =>
  s.batterySaver ? 'Minimal' : s.detectionMode;
