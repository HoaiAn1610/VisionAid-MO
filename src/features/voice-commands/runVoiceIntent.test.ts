import { Strings } from '@/constants/strings.vi';

import { MIN_MEDIA_VOLUME, runVoiceIntent, type VoiceContext } from './runVoiceIntent';

const ctx = (over: Partial<VoiceContext> = {}): VoiceContext & { spoken: string[] } => {
  const spoken: string[] = [];
  return {
    spoken,
    say: (t) => void spoken.push(t),
    navigationActive: false,
    startNavigation: jest.fn(),
    stopNavigation: jest.fn(),
    openQrScanner: jest.fn(),
    openTextReader: jest.fn(),
    openFaceRecognizer: jest.fn(),
    openLocation: jest.fn(),
    openEmergency: jest.fn(),
    setDetectionMode: jest.fn(),
    speechRate: 1,
    setSpeechRate: jest.fn(),
    lastAnnouncement: null,
    mediaVolume: 0.5,
    setMediaVolume: jest.fn(),
    ...over,
  };
};

describe('runVoiceIntent', () => {
  it('"bắt đầu" → bắt đầu dẫn đường; "dừng lại" khi chưa dẫn đường → báo, không gọi stop', () => {
    const c = ctx();
    runVoiceIntent('START_NAVIGATION', c);
    runVoiceIntent('STOP_NAVIGATION', c);
    expect(c.startNavigation).toHaveBeenCalled();
    expect(c.stopNavigation).not.toHaveBeenCalled();
    expect(c.spoken).toEqual([Strings.voice.notNavigating]);
  });

  it('"dừng lại" khi đang dẫn đường → dừng', () => {
    const c = ctx({ navigationActive: true });
    runVoiceIntent('STOP_NAVIGATION', c);
    expect(c.stopNavigation).toHaveBeenCalled();
  });

  it('đổi chế độ + TTS xác nhận', () => {
    const c = ctx();
    runVoiceIntent('MODE_MINIMAL', c);
    expect(c.setDetectionMode).toHaveBeenCalledWith('Minimal');
    expect(c.spoken).toEqual([Strings.voice.modeMinimal]);
  });

  it('đọc nhanh/chậm hơn từng nấc 0.25, chặn trong 0.5–2.0', () => {
    const c = ctx({ speechRate: 1 });
    runVoiceIntent('SPEED_UP', c);
    expect(c.setSpeechRate).toHaveBeenCalledWith(1.25);

    const max = ctx({ speechRate: 2 });
    runVoiceIntent('SPEED_UP', max);
    expect(max.setSpeechRate).not.toHaveBeenCalled();
    expect(max.spoken).toEqual([Strings.voice.fastest]);

    const min = ctx({ speechRate: 0.5 });
    runVoiceIntent('SLOW_DOWN', min);
    expect(min.spoken).toEqual([Strings.voice.slowest]);
  });

  it('"trợ giúp" đọc danh sách lệnh; "lặp lại" đọc câu trước đó', () => {
    const c = ctx({ lastAnnouncement: 'Xe máy ở gần' });
    runVoiceIntent('HELP', c);
    runVoiceIntent('REPEAT', c);
    expect(c.spoken[0]).toContain('bắt đầu');
    expect(c.spoken[0]).toContain('gọi khẩn cấp');
    expect(c.spoken[1]).toBe('Xe máy ở gần');
  });

  it('lệnh của sprint sau → báo đang phát triển, trả false (log Failed)', () => {
    const c = ctx();
    expect(runVoiceIntent('I_AM_OK', c)).toBe(false);
    expect(c.spoken).toEqual([Strings.voice.notImplemented]);
  });

  it('"quét mã" → mở màn quét QR', () => {
    const c = ctx();
    expect(runVoiceIntent('SCAN_QR', c)).toBe(true);
    expect(c.openQrScanner).toHaveBeenCalled();
  });

  it('"tăng âm lượng" / "giảm âm lượng" đổi âm lượng media từng nấc, không xuống dưới mức tối thiểu', () => {
    const up = ctx({ mediaVolume: 0.5 });
    runVoiceIntent('VOLUME_UP', up);
    expect(up.setMediaVolume).toHaveBeenCalledWith(0.65);
    expect(up.spoken).toEqual([Strings.voice.louder]);

    const down = ctx({ mediaVolume: 0.4 });
    runVoiceIntent('VOLUME_DOWN', down);
    expect(down.setMediaVolume).toHaveBeenCalledWith(MIN_MEDIA_VOLUME);

    const floor = ctx({ mediaVolume: MIN_MEDIA_VOLUME });
    runVoiceIntent('VOLUME_DOWN', floor);
    expect(floor.setMediaVolume).not.toHaveBeenCalled();
    expect(floor.spoken).toEqual([Strings.voice.quietest]);

    const max = ctx({ mediaVolume: 1 });
    runVoiceIntent('VOLUME_UP', max);
    expect(max.spoken).toEqual([Strings.voice.loudest]);

    const unsupported = ctx({ mediaVolume: null });
    runVoiceIntent('VOLUME_UP', unsupported);
    expect(unsupported.spoken).toEqual([Strings.errors.unavailable]);
  });

  it('"đọc chữ" / "đây là ai" → mở màn đọc chữ / nhận diện người quen', () => {
    const c = ctx();
    expect(runVoiceIntent('READ_TEXT', c)).toBe(true);
    expect(runVoiceIntent('RECOGNIZE_FACE', c)).toBe(true);
    expect(c.openTextReader).toHaveBeenCalled();
    expect(c.openFaceRecognizer).toHaveBeenCalled();
    expect(runVoiceIntent('WHERE_AM_I', c)).toBe(true);
    expect(c.openLocation).toHaveBeenCalled();
  });

  it('lệnh đã có tính năng → trả true', () => {
    expect(runVoiceIntent('HELP', ctx())).toBe(true);
  });
});
