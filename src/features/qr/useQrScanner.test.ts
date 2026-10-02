import { act, renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';
import type { Code } from 'react-native-vision-camera';

import { Strings } from '@/constants/strings.vi';
import { confirmByVoice } from '@/features/voice-commands/confirmByVoice';
import { enqueue } from '@/services/storage/offlineQueue';
import { ttsService } from '@/services/tts/TtsService';

import { useQrScanner } from './useQrScanner';

let mockOnScanned: (codes: Code[]) => void = () => {};
jest.mock('react-native-vision-camera', () => ({
  useCameraPermission: () => ({ hasPermission: true, requestPermission: jest.fn() }),
  useCodeScanner: (opts: { onCodeScanned: (codes: Code[]) => void }) => {
    mockOnScanned = opts.onCodeScanned;
    return opts;
  },
}));
jest.mock('@/services/storage/offlineQueue', () => ({ enqueue: jest.fn(async () => {}) }));
jest.mock('@/features/sync/offlineSync', () => ({ syncOfflineNow: jest.fn() }));
jest.mock('@/features/voice-commands/confirmByVoice', () => ({ confirmByVoice: jest.fn() }));
jest.mock('@/services/speech/SpeechService', () => ({ speechService: { abort: jest.fn() } }));
jest.mock('@/services/haptics/HapticService', () => ({ HapticService: { success: jest.fn() } }));
jest.mock('@/services/tts/TtsService', () => ({
  TtsPriority: { SYSTEM: 2, FEEDBACK: 3 },
  ttsService: { enqueue: jest.fn() },
}));

const spoken = () => (ttsService.enqueue as jest.Mock).mock.calls.map((c) => c[0].text as string);
const scan = (value: string) => mockOnScanned([{ type: 'qr', value } as Code]);
const cancel = jest.fn();
function confirmWith(confirmed: boolean) {
  (confirmByVoice as jest.Mock).mockReturnValue({
    result: Promise.resolve(confirmed ? new Date() : null),
    cancel,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

describe('useQrScanner', () => {
  it('mở màn hình → đọc hướng dẫn hướng camera vào mã', async () => {
    await renderHook(() => useQrScanner('Tap'));
    expect(spoken()).toContain(Strings.qr.aim);
  });

  it('mã URL → đọc tên miền, ghi log, hỏi; nói "đồng ý" → mở trang', async () => {
    confirmWith(true);
    const { result } = await renderHook(() => useQrScanner('VoiceCommand'));
    await act(async () => scan('https://example.com/a'));

    expect(result.current.phase).toBe('result');
    expect(spoken()).toContain(Strings.qr.url('example.com'));
    expect(confirmByVoice).toHaveBeenCalledWith(
      Strings.qr.askOpen('example.com'),
      Strings.qr.notOpened,
    );
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/a');
    expect(enqueue).toHaveBeenCalledWith(
      'qr',
      expect.objectContaining({
        qrContent: 'https://example.com/a',
        qrType: 'Url',
        isUrl: true,
        urlDomain: 'example.com',
        triggerMethod: 'VoiceCommand',
        resultStatus: 'Success',
      }),
    );
  });

  it('URL nhưng không xác nhận → KHÔNG mở', async () => {
    confirmWith(false);
    await renderHook(() => useQrScanner('Tap'));
    await act(async () => scan('https://example.com'));
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('mã văn bản → chỉ đọc, không hỏi mở', async () => {
    await renderHook(() => useQrScanner('Tap'));
    await act(async () => scan('Phòng 301'));
    expect(spoken()).toContain(Strings.qr.text('Phòng 301'));
    expect(confirmByVoice).not.toHaveBeenCalled();
  });

  it('camera báo cùng một mã nhiều lần → chỉ xử lý MỘT lần', async () => {
    await renderHook(() => useQrScanner('Tap'));
    await act(async () => {
      scan('Phòng 301');
      scan('Phòng 301');
    });
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('chạm "Mở trang" khi đang hỏi → dừng hỏi im lặng rồi mở', async () => {
    (confirmByVoice as jest.Mock).mockReturnValue({ result: new Promise(() => {}), cancel });
    const { result } = await renderHook(() => useQrScanner('Tap'));
    await act(async () => scan('https://example.com'));
    await act(async () => result.current.openLink());
    expect(cancel).toHaveBeenCalledWith(true);
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
  });

  it('"Quét mã khác" → quay lại quét, đọc lại hướng dẫn, nhận mã mới', async () => {
    const { result } = await renderHook(() => useQrScanner('Tap'));
    await act(async () => scan('A'));
    await act(async () => result.current.scanAgain());
    expect(result.current.phase).toBe('scanning');
    await act(async () => scan('B'));
    expect(enqueue).toHaveBeenCalledTimes(2);
  });
});
