import { useMutation } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { ApiError } from '@/api/client';
import { changePassword } from '@/api/endpoints/auth';
import { BusinessRules } from '@/constants/businessRules';
import type { DetectionMode } from '@/constants/enums';
import { Strings } from '@/constants/strings.vi';
import { signOut } from '@/features/auth/authService';
import { HapticService } from '@/services/haptics/HapticService';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { selectEffectiveMode, useSettingsStore } from '@/stores/settingsStore';

import { validatePasswordChange } from './passwordRules';
import { chooseDetectionMode, preferences } from './preferencesService';

const VOLUME_STEP = 0.1;
const say = (text: string, priority = TtsPriority.FEEDBACK): void => {
  ttsService.enqueue({ text, priority });
};

/** Đổi tùy chọn rồi đọc xác nhận — bằng chính tốc độ / âm lượng mới để người dùng nghe thử. */
async function changeAndConfirm(
  change: Promise<'saved' | 'local'>,
  confirm: string,
): Promise<void> {
  const result = await change;
  void HapticService.tap();
  say(result === 'saved' ? confirm : `${confirm}. ${Strings.settings.savedLocal}`);
}

export const settingsActions = {
  changeSpeed(faster: boolean): void {
    const { speedRate } = preferences.get();
    const step = BusinessRules.TTS_SPEED_STEP;
    const next = Math.min(
      BusinessRules.TTS_MAX_SPEED,
      Math.max(BusinessRules.TTS_MIN_SPEED, speedRate + (faster ? step : -step)),
    );
    if (next === speedRate) return say(Strings.settings.atLimit);
    void changeAndConfirm(
      preferences.update({ speedRate: next }),
      Strings.settings.speedChanged(next),
    );
  },
  changeVolume(louder: boolean): void {
    const { volumeLevel } = preferences.get();
    const next =
      Math.round(
        Math.min(1, Math.max(VOLUME_STEP, volumeLevel + (louder ? VOLUME_STEP : -VOLUME_STEP))) *
          10,
      ) / 10;
    if (next === volumeLevel) return say(Strings.settings.atLimit);
    void changeAndConfirm(
      preferences.update({ volumeLevel: next }),
      Strings.settings.volumeChanged(next),
    );
  },
  setMode(detectionMode: DetectionMode): void {
    const confirm = detectionMode === 'Full' ? Strings.voice.modeFull : Strings.voice.modeMinimal;
    const { batterySaver } = useSettingsStore.getState();
    if (!batterySaver && preferences.get().detectionMode === detectionMode) return say(confirm);
    void changeAndConfirm(chooseDetectionMode(detectionMode), confirm);
  },
};

/** Mọi thay đổi tùy chọn đều đi qua `apply` → đặt lại settingsStore → dùng store đó làm tín hiệu. */
const subscribe = (listener: () => void) => useSettingsStore.subscribe(listener);

/** Giá trị đang áp dụng (để hiện trên màn hình). Đọc từng số — getSettings() trả object mới mỗi lần. */
export function usePreferenceValues(): {
  speedRate: number;
  volumeLevel: number;
  detectionMode: DetectionMode;
  batterySaver: boolean;
} {
  const detectionMode = useSettingsStore(selectEffectiveMode);
  const batterySaver = useSettingsStore((s) => s.batterySaver);
  const speedRate = useSyncExternalStore(subscribe, () => ttsService.getSettings().rate);
  const volumeLevel = useSyncExternalStore(subscribe, () => ttsService.getSettings().volume);
  return { speedRate, volumeLevel, detectionMode, batterySaver };
}

export function passwordErrorMessage(error: unknown): string {
  if (error instanceof Error && !(error instanceof ApiError)) return error.message;
  if (error instanceof ApiError && error.status === 403) return Strings.password.wrongCurrent;
  if (error instanceof ApiError && error.status === 400) return Strings.password.weak;
  return Strings.errors.unavailable;
}

/** Đổi mật khẩu: kiểm tra trên máy → server → server thu hồi mọi phiên → đăng xuất, đăng nhập lại. */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (v: { current: string; next: string; confirm: string }) => {
      const invalid = validatePasswordChange(v.current, v.next, v.confirm);
      if (invalid) throw new Error(invalid);
      await changePassword(v.current, v.next);
    },
    onSuccess: async () => {
      void HapticService.success();
      say(Strings.password.changed, TtsPriority.SYSTEM);
      await signOut();
    },
    onError: (error) => {
      void HapticService.warning();
      say(passwordErrorMessage(error), TtsPriority.SYSTEM);
    },
  });
}
