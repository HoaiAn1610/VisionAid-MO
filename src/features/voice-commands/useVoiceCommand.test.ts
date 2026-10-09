import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo, Linking } from 'react-native';

import { Strings } from '@/constants/strings.vi';
import { OfflineSpeechUnavailableError, speechService } from '@/services/speech/SpeechService';
import { ttsService } from '@/services/tts/TtsService';

import { startConfirmation } from './confirmationFlow';
import { useVoiceCommand } from './useVoiceCommand';
import { recordVoiceCommand } from './voiceLog';

const mockPermission = { granted: true };
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    getPermissionsAsync: jest.fn(async () => mockPermission),
    requestPermissionsAsync: jest.fn(async () => mockPermission),
  },
}));
jest.mock('@/services/speech/SpeechService', () => ({
  OfflineSpeechUnavailableError: class OfflineSpeechUnavailableError extends Error {},
  speechService: { listenOnce: jest.fn(), abort: jest.fn() },
}));
jest.mock('@/services/tts/TtsService', () => ({
  TtsPriority: { EMERGENCY: 0, DANGER: 1, SYSTEM: 2, FEEDBACK: 3, INFO: 4 },
  ttsService: {
    enqueue: jest.fn(() => true),
    getLastText: jest.fn(() => null),
    getSettings: jest.fn(() => ({ rate: 1 })),
    updateSettings: jest.fn(),
  },
}));
jest.mock('@/services/haptics/HapticService', () => ({ HapticService: { tap: jest.fn() } }));
jest.mock('./confirmationFlow', () => ({ startConfirmation: jest.fn() }));
jest.mock('./voiceLog', () => ({
  toVoiceLog: jest.fn((turn: { status: string }) => ({ executionStatus: turn.status })),
  recordVoiceCommand: jest.fn(),
}));

const listen = speechService.listenOnce as jest.Mock;
const spoken = () => (ttsService.enqueue as jest.Mock).mock.calls.map((c) => c[0].text as string);
const heard = (transcript: string) => ({
  engine: 'GoogleSpeech',
  alternatives: transcript ? [{ transcript, confidence: 0.9 }] : [],
  discardedAsEcho: false,
  isOffline: false,
  processingTimeMs: 100,
});

/** Luồng xác nhận giả: chốt kết quả theo câu nghe được. */
function mockConfirmation(answerConfirms: boolean) {
  type Result = { status: string; confirmedAt?: string };
  let resolve: (r: Result) => void = () => {};
  const result = new Promise<Result>((r) => (resolve = r));
  const flow = {
    result,
    settled: false,
    hear: () => {
      flow.settled = true;
      resolve(
        answerConfirms
          ? { status: 'Confirmed', confirmedAt: new Date().toISOString() }
          : { status: 'Cancelled' },
      );
    },
    cancel: () => {
      flow.settled = true;
      resolve({ status: 'Cancelled' });
    },
  };
  (startConfirmation as jest.Mock).mockReturnValue(flow);
}

const nav = {
  active: false,
  start: jest.fn(),
  stop: jest.fn(),
  openQrScanner: jest.fn(),
  openTextReader: jest.fn(),
  openFaceRecognizer: jest.fn(),
  openLocation: jest.fn(),
  openEmergency: jest.fn(),
  dismissFall: jest.fn(() => false),
  callCaregiver: jest.fn(),
  endCall: jest.fn(() => false),
};
const loggedStatuses = () =>
  (recordVoiceCommand as jest.Mock).mock.calls.map((c) => c[0].executionStatus as string);

beforeEach(() => {
  jest.clearAllMocks();
  mockPermission.granted = true;
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
});

describe('useVoiceCommand', () => {
  it('"bắt đầu" → bắt đầu dẫn đường, sheet đóng lại sau lượt nói', async () => {
    listen.mockResolvedValueOnce(heard('bắt đầu'));
    const { result } = await renderHook(() => useVoiceCommand(nav));
    await act(() => result.current.start());
    expect(nav.start).toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
    expect(result.current.heard).toBe('bắt đầu');
    expect(loggedStatuses()).toEqual(['Success']);
  });

  it('không khớp lệnh nào → "Tôi chưa hiểu", không thực thi gì', async () => {
    listen.mockResolvedValueOnce(heard('hôm nay trời đẹp'));
    const { result } = await renderHook(() => useVoiceCommand(nav));
    await act(() => result.current.start());
    expect(spoken()).toEqual([Strings.voice.notUnderstood]);
    expect(nav.start).not.toHaveBeenCalled();
    expect(loggedStatuses()).toEqual(['Unrecognized']);
  });

  it('"gọi khẩn cấp" → xác nhận; nói "có" → thực thi', async () => {
    mockConfirmation(true);
    listen.mockResolvedValueOnce(heard('gọi khẩn cấp')).mockResolvedValueOnce(heard('có'));
    const { result } = await renderHook(() => useVoiceCommand(nav));
    await act(() => result.current.start());
    expect(startConfirmation).toHaveBeenCalled();
    expect(listen).toHaveBeenCalledTimes(2); // không mở mic thừa sau khi đã xác nhận
    expect(nav.openEmergency).toHaveBeenCalled(); // màn khẩn cấp gửi SOS ngay, không hỏi lại
    expect(loggedStatuses()).toEqual(['Confirmed']);
  });

  it('"gọi khẩn cấp" nhưng không xác nhận → không thực thi', async () => {
    mockConfirmation(false);
    listen.mockResolvedValueOnce(heard('gọi khẩn cấp')).mockResolvedValueOnce(heard('không'));
    const { result } = await renderHook(() => useVoiceCommand(nav));
    await act(() => result.current.start());
    expect(nav.openEmergency).not.toHaveBeenCalled();
    expect(loggedStatuses()).toEqual(['Cancelled']);
  });

  it('không nghe thấy gì → "Tôi chưa hiểu", KHÔNG ghi log', async () => {
    listen.mockResolvedValueOnce(heard(''));
    const { result } = await renderHook(() => useVoiceCommand(nav));
    await act(() => result.current.start());
    expect(spoken()).toEqual([Strings.voice.notUnderstood]);
    expect(recordVoiceCommand).not.toHaveBeenCalled();
  });

  it('tự nghe khi mở app mà im lặng → nhắc cách gọi lại; sau kết quả mà im lặng → không nói gì', async () => {
    listen.mockResolvedValueOnce(heard('')).mockResolvedValueOnce(heard(''));
    const { result } = await renderHook(() => useVoiceCommand(nav));
    await act(() => result.current.start('launch'));
    expect(spoken()).toEqual([Strings.voice.wakeHint]);
    await act(() => result.current.start('follow-up'));
    expect(spoken()).toEqual([Strings.voice.wakeHint]);
    expect(recordVoiceCommand).not.toHaveBeenCalled();
  });

  it('tự nghe sau kết quả mà có lệnh → thực thi như bình thường', async () => {
    listen.mockResolvedValueOnce(heard('đọc chữ'));
    const { result } = await renderHook(() => useVoiceCommand(nav));
    await act(() => result.current.start('follow-up'));
    expect(nav.openTextReader).toHaveBeenCalled();
    expect(loggedStatuses()).toEqual(['Success']);
  });

  it('chưa có quyền micro: giải thích bằng TTS trước; bị từ chối → mở cài đặt, không nghe', async () => {
    mockPermission.granted = false;
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const { result } = await renderHook(() => useVoiceCommand(nav));
    await act(() => result.current.start());
    expect(spoken()).toEqual([Strings.voice.micExplain, Strings.voice.micDenied]);
    expect(openSettings).toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
  });

  it('bấm Hủy khi đang nghe → đóng mic, báo đã hủy, không thực thi lệnh nghe được', async () => {
    let finish: (v: unknown) => void = () => {};
    listen.mockReturnValueOnce(new Promise((r) => (finish = r)));
    const { result } = await renderHook(() => useVoiceCommand(nav));
    let pending: Promise<void> = Promise.resolve();
    await act(async () => {
      pending = result.current.start();
    });
    expect(result.current.phase).toBe('listening');
    await act(async () => result.current.cancel());
    await act(async () => {
      finish(heard('bắt đầu'));
      await pending;
    });
    expect(speechService.abort).toHaveBeenCalled();
    expect(spoken()).toContain(Strings.voice.cancelled);
    expect(nav.start).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
  });

  it('offline không nhận dạng được → không đọc thêm lỗi (SpeechService đã hướng dẫn)', async () => {
    listen.mockRejectedValueOnce(new OfflineSpeechUnavailableError());
    const { result } = await renderHook(() => useVoiceCommand(nav));
    await act(() => result.current.start());
    expect(spoken()).toEqual([]);
  });
});
