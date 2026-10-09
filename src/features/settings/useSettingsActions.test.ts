import { Strings } from '@/constants/strings.vi';
import { ttsService } from '@/services/tts/TtsService';
import { selectEffectiveMode, useSettingsStore } from '@/stores/settingsStore';

import { chooseDetectionMode, preferences } from './preferencesService';
import { passwordErrorMessage, settingsActions } from './useSettingsActions';
import { ApiError } from '@/api/client';

jest.mock('./preferencesService', () => ({
  preferences: { get: jest.fn(), update: jest.fn(async () => 'saved') },
  chooseDetectionMode: jest.fn(async () => 'saved'),
}));
jest.mock('@/services/tts/TtsService', () => ({
  TtsPriority: { SYSTEM: 2, FEEDBACK: 3 },
  ttsService: { enqueue: jest.fn(), getSettings: jest.fn() },
}));
jest.mock('@/features/auth/authService', () => ({ signOut: jest.fn() }));

const prefs = preferences as jest.Mocked<typeof preferences>;
const flush = () => new Promise((r) => setImmediate(r));
const spoken = () => (ttsService.enqueue as jest.Mock).mock.calls.map((c) => c[0].text);

beforeEach(() => {
  jest.clearAllMocks();
  prefs.get.mockReturnValue({ speedRate: 1, volumeLevel: 0.5, detectionMode: 'Full' });
});

describe('settingsActions', () => {
  it('nhanh hơn → +0.25, đọc xác nhận', async () => {
    settingsActions.changeSpeed(true);
    await flush();
    expect(prefs.update).toHaveBeenCalledWith({ speedRate: 1.25 });
    expect(spoken()).toContain(Strings.settings.speedChanged(1.25));
  });

  it('đã ở mức tối đa → báo giới hạn, không lưu', () => {
    prefs.get.mockReturnValue({ speedRate: 2, volumeLevel: 1, detectionMode: 'Full' });
    settingsActions.changeSpeed(true);
    settingsActions.changeVolume(true);
    expect(prefs.update).not.toHaveBeenCalled();
    expect(spoken()).toEqual([Strings.settings.atLimit, Strings.settings.atLimit]);
  });

  it('âm lượng không xuống dưới 10% (luôn nghe được phản hồi)', async () => {
    prefs.get.mockReturnValue({ speedRate: 1, volumeLevel: 0.1, detectionMode: 'Full' });
    settingsActions.changeVolume(false);
    expect(prefs.update).not.toHaveBeenCalled();
  });

  it('offline → báo đã lưu trên máy, sẽ đồng bộ', async () => {
    (chooseDetectionMode as jest.Mock).mockResolvedValueOnce('local');
    settingsActions.setMode('Minimal');
    await flush();
    expect(spoken()[0]).toBe(`${Strings.voice.modeMinimal}. ${Strings.settings.savedLocal}`);
  });
});

describe('chế độ khi pin yếu', () => {
  afterEach(() => useSettingsStore.setState({ batterySaver: false }));

  it('đang tiết kiệm pin → chọn lại đúng chế độ cũ vẫn bỏ tiết kiệm pin', async () => {
    useSettingsStore.setState({ batterySaver: true });
    settingsActions.setMode('Full'); // preference đang là Full
    await flush();
    expect(chooseDetectionMode).toHaveBeenCalledWith('Full');
  });

  it('không tiết kiệm pin, chọn trùng chế độ → chỉ đọc xác nhận', () => {
    settingsActions.setMode('Full');
    expect(chooseDetectionMode).not.toHaveBeenCalled();
    expect(spoken()).toEqual([Strings.voice.modeFull]);
  });

  it('chế độ thực tế: pin yếu ép Tối giản, không đổi lựa chọn của người dùng', () => {
    const s = { detectionMode: 'Full' as const, batterySaver: true };
    expect(selectEffectiveMode({ ...useSettingsStore.getState(), ...s })).toBe('Minimal');
    expect(selectEffectiveMode({ ...useSettingsStore.getState(), ...s, batterySaver: false })).toBe(
      'Full',
    );
  });
});

describe('passwordErrorMessage', () => {
  it('403 = sai mật khẩu hiện tại; lỗi kiểm tra trên máy giữ nguyên câu', () => {
    expect(passwordErrorMessage(new ApiError(403, 'Forbidden', ''))).toBe(
      Strings.password.wrongCurrent,
    );
    expect(passwordErrorMessage(new Error(Strings.password.mismatch))).toBe(
      Strings.password.mismatch,
    );
    expect(passwordErrorMessage(new ApiError(0, 'Network Error', ''))).toBe(
      Strings.errors.unavailable,
    );
  });
});
