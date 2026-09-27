import { act, renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { Strings } from '@/constants/strings.vi';
import { ttsService } from '@/services/tts/TtsService';

import {
  endNavigationSession,
  recordDetectionEvent,
  startNavigationSession,
} from './navigationSession';
import type { FrameResult } from './useObstacleDetector';
import { useObstacleNavigation } from './useObstacleNavigation';

const mockPermission = { hasPermission: true, requestPermission: jest.fn(async () => true) };
jest.mock('react-native-vision-camera', () => ({ useCameraPermission: () => mockPermission }));

const mockDetector: {
  modelState: 'loading' | 'loaded' | 'error';
  usingCpuFallback: boolean;
  onResult?: (r: FrameResult) => void;
} = { modelState: 'loaded', usingCpuFallback: false };
jest.mock('./useObstacleDetector', () => ({
  useObstacleDetector: (
    _s: unknown,
    _d: unknown,
    opts: { onResult?: (r: FrameResult) => void },
  ) => {
    mockDetector.onResult = opts.onResult;
    return {
      frameProcessor: {},
      modelState: mockDetector.modelState,
      usingCpuFallback: mockDetector.usingCpuFallback,
    };
  },
}));
jest.mock('../../../assets/models/yolov8n_float16.tflite', () => 1, { virtual: true });
jest.mock('./navigationSession', () => ({
  startNavigationSession: jest.fn(async () => 'L1'),
  endNavigationSession: jest.fn(async () => {}),
  recordDetectionEvent: jest.fn(async () => {}),
}));
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => {}),
  deactivateKeepAwake: jest.fn(async () => {}),
}));
jest.mock('@/services/haptics/HapticService', () => ({
  HapticService: { success: jest.fn(), tap: jest.fn() },
}));
jest.mock('@/services/tts/TtsService', () => ({
  TtsPriority: { EMERGENCY: 0, DANGER: 1, SYSTEM: 2, FEEDBACK: 3, INFO: 4 },
  ttsService: { enqueue: jest.fn(() => true) },
}));

const enqueue = ttsService.enqueue as jest.Mock;
const spoken = () => enqueue.mock.calls.map((c) => (c[0] as { text: string }).text);

const frame = (label: string, over = {}): FrameResult => ({
  preprocessMs: 8,
  inferenceMs: 30,
  postprocessMs: 12,
  detections: [{ label, classId: 0, score: 0.9, x: 0.2, y: 0.2, w: 0.6, h: 0.6, ...over }],
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPermission.hasPermission = true;
  mockPermission.requestPermission.mockResolvedValue(true);
  mockDetector.modelState = 'loaded';
  mockDetector.usingCpuFallback = false;
  enqueue.mockReturnValue(true);
});

describe('useObstacleNavigation', () => {
  it('bắt đầu: tạo session, TTS "bắt đầu dẫn đường"; dừng: đóng session, TTS "đã dừng"', async () => {
    const { result } = await renderHook(() => useObstacleNavigation());
    await act(() => result.current.start());
    expect(result.current.active).toBe(true);
    expect(startNavigationSession).toHaveBeenCalledWith('Full');
    expect(spoken()).toContain(Strings.navigation.started);

    await act(async () => result.current.stop());
    expect(result.current.active).toBe(false);
    expect(endNavigationSession).toHaveBeenCalledWith('L1');
    expect(spoken()).toContain(Strings.navigation.stopped);
  });

  it('bấm Dừng khi session chưa tạo xong → session vẫn được đóng (không bị bỏ rơi)', async () => {
    let resolveStart: (id: string) => void = () => {};
    (startNavigationSession as jest.Mock).mockImplementationOnce(
      () => new Promise<string>((r) => (resolveStart = r)),
    );
    const { result } = await renderHook(() => useObstacleNavigation());
    let starting: Promise<void> = Promise.resolve();
    await act(async () => {
      starting = result.current.start();
    });
    await act(async () => result.current.stop());
    await act(async () => {
      resolveStart('L-late');
      await starting;
    });
    expect(endNavigationSession).toHaveBeenCalledWith('L-late');
    expect(result.current.active).toBe(false);
  });

  it('bấm Bắt đầu hai lần liên tiếp (TalkBack chạm đúp) → chỉ tạo MỘT session', async () => {
    const { result } = await renderHook(() => useObstacleNavigation());
    await act(async () => {
      await Promise.all([result.current.start(), result.current.start()]);
    });
    expect(startNavigationSession).toHaveBeenCalledTimes(1);
  });

  it('vật cản được đọc → ghi event alertIssued với box chuẩn hóa', async () => {
    const { result } = await renderHook(() => useObstacleNavigation());
    await act(() => result.current.start());
    await act(async () => mockDetector.onResult?.(frame('motorcycle')));

    expect(result.current.lastAnnouncement).toBe(`Xe máy ${Strings.distance.Near}`);
    expect(recordDetectionEvent).toHaveBeenCalledWith(
      'L1',
      expect.objectContaining({
        objectClass: 'motorcycle',
        distanceRange: 'Near',
        alertIssued: true,
        inferenceTimeMs: 30,
        boundingBox: '{"x":0.2,"y":0.2,"w":0.6,"h":0.6}',
      }),
    );
  });

  it('dòng trạng thái tự về "chưa phát hiện" khi 4s không có cảnh báo mới', async () => {
    jest.useFakeTimers();
    const { result } = await renderHook(() => useObstacleNavigation());
    await act(() => result.current.start());
    await act(async () => mockDetector.onResult?.(frame('car')));
    expect(result.current.lastAnnouncement).not.toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(result.current.lastAnnouncement).toBeNull();
    jest.useRealTimers();
  });

  it('câu bị cooldown chặn → KHÔNG ghi event', async () => {
    const { result } = await renderHook(() => useObstacleNavigation());
    await act(() => result.current.start());
    enqueue.mockReturnValue(false);
    await act(async () => mockDetector.onResult?.(frame('car')));
    expect(recordDetectionEvent).not.toHaveBeenCalled();
  });

  it('chưa có quyền camera: giải thích bằng TTS trước; bị từ chối → mở cài đặt, không bắt đầu', async () => {
    mockPermission.hasPermission = false;
    mockPermission.requestPermission.mockResolvedValue(false);
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const { result } = await renderHook(() => useObstacleNavigation());
    await act(() => result.current.start());

    expect(spoken()[0]).toBe(Strings.navigation.cameraExplain);
    expect(spoken()).toContain(Strings.navigation.cameraDenied);
    expect(openSettings).toHaveBeenCalled();
    expect(result.current.active).toBe(false);
    expect(startNavigationSession).not.toHaveBeenCalled();
  });

  it('model chưa nạp xong: báo "đang chuẩn bị", rồi "bắt đầu" khi model sẵn sàng', async () => {
    mockDetector.modelState = 'loading';
    const { result, rerender } = await renderHook(() => useObstacleNavigation());
    await act(() => result.current.start());
    expect(spoken()).toContain(Strings.navigation.modelLoading);
    expect(spoken()).not.toContain(Strings.navigation.started);

    mockDetector.modelState = 'loaded';
    await rerender({});
    expect(spoken()).toContain(Strings.navigation.started);
  });

  it('GPU lỗi (đang lùi về CPU) → chưa dừng; CPU cũng lỗi → dừng phiên + TTS', async () => {
    const { result, rerender } = await renderHook(() => useObstacleNavigation());
    await act(() => result.current.start());

    mockDetector.modelState = 'error';
    await rerender({});
    expect(result.current.active).toBe(true);

    mockDetector.usingCpuFallback = true;
    await rerender({});
    expect(result.current.active).toBe(false);
    expect(spoken()).toContain(Strings.navigation.modelFailed);
    expect(endNavigationSession).toHaveBeenCalledWith('L1');
  });
});
