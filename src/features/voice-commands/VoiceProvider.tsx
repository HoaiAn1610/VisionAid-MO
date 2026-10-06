import { router, usePathname } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

import { Strings } from '@/constants/strings.vi';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import { isOnDeviceSpeechReady } from '@/services/speech/onDeviceSpeech';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';

import { addVolumeKeyListener, getMediaVolume, setMediaVolume } from '../../../modules/volume-key';

import { MIN_MEDIA_VOLUME } from './runVoiceIntent';
import { useVoiceCommand, type ListenMode, type VoicePhase } from './useVoiceCommand';
import { VoiceSheet } from './VoiceSheet';

/** Điều khiển dẫn đường — Home đăng ký (camera + YOLO nằm ở Home). */
export interface NavigationHandle {
  active: boolean;
  start(): void;
  stop(): void;
}

interface VoiceApi {
  phase: VoicePhase;
  listen(mode?: ListenMode): void;
  /** Home gọi khi mount / đổi trạng thái; null khi unmount. */
  registerNavigation(handle: NavigationHandle | null): void;
  /**
   * Màn hình đăng ký hành động "làm lại" (chụp lại, hỏi lại vị trí): lệnh mở lại chính màn đang mở
   * thì chạy hành động đó thay vì chồng thêm màn mới.
   */
  registerScreenAction(route: ScreenRoute, action: (() => void) | null): void;
}

type ScreenRoute = '/read-text' | '/face' | '/location';

const VoiceContext = createContext<VoiceApi | null>(null);

export function useVoice(): VoiceApi {
  const api = useContext(VoiceContext);
  if (!api) throw new Error('useVoice must be used inside VoiceProvider');
  return api;
}

/** Không có mạng mà máy không nhận dạng offline được → chế độ tự nghe im lặng bỏ qua. */
const canListenSilently = () => NetworkMonitor.isOnline() || isOnDeviceSpeechReady();

/**
 * Lệnh giọng nói dùng chung cho mọi màn hình (FE-09, §5.6): tự nghe khi mở app và sau mỗi kết
 * quả; nhấn nút tăng/giảm âm lượng (hoặc nút trên Home) để ra lệnh bất cứ lúc nào. Âm lượng
 * đổi bằng lệnh "tăng âm lượng" / "giảm âm lượng".
 */
export function VoiceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const navigation = useRef<NavigationHandle | null>(null);
  const screenActions = useRef(new Map<string, () => void>());

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  /** Lệnh mở màn đang mở → chạy lại hành động của màn đó, không chồng thêm màn mới. */
  const openScreen = useCallback((route: ScreenRoute) => {
    const action = screenActions.current.get(route);
    if (pathRef.current === route && action) return action();
    router.push({ pathname: route, params: { via: 'voice' } });
  }, []);

  const voice = useVoiceCommand(
    useMemo(
      () => ({
        get active() {
          return navigation.current?.active ?? false;
        },
        start: () => {
          if (router.canDismiss()) router.dismissAll(); // camera dẫn đường nằm ở Home
          navigation.current?.start();
        },
        stop: () => navigation.current?.stop(),
        openQrScanner: () => router.push({ pathname: '/ocr', params: { via: 'voice' } }),
        openTextReader: () => openScreen('/read-text'),
        openFaceRecognizer: () => openScreen('/face'),
        openLocation: () => openScreen('/location'),
        openEmergency: () => router.push({ pathname: '/emergency', params: { via: 'voice' } }),
      }),
      [openScreen],
    ),
  );
  const { start, cancel, phase } = voice;
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const listen = useCallback(
    (mode: ListenMode = 'manual') => {
      if (mode === 'follow-up' && !canListenSilently()) return;
      void start(mode);
    },
    [start],
  );

  // Mở app → chào + tự nghe lệnh (người dùng không cần tìm nút). Phím âm lượng không còn chỉnh
  // âm lượng → nâng lên mức nghe được trước khi nói.
  useEffect(() => {
    const volume = getMediaVolume();
    if (volume !== null && volume < MIN_MEDIA_VOLUME) setMediaVolume(MIN_MEDIA_VOLUME);
    ttsService.enqueue({ text: Strings.app.ready, priority: TtsPriority.SYSTEM });
    void start('launch');
  }, [start]);

  // Nút tăng/giảm âm lượng = nút ra lệnh: đang nghe → hủy, không thì bắt đầu nghe
  useEffect(() => {
    const sub = addVolumeKeyListener(() => {
      if (phaseRef.current === 'idle') void start('manual');
      else cancel();
    });
    return () => sub?.remove();
  }, [start, cancel]);

  const api = useMemo<VoiceApi>(
    () => ({
      phase,
      listen,
      registerNavigation: (handle) => {
        navigation.current = handle;
      },
      registerScreenAction: (route, action) => {
        if (action) screenActions.current.set(route, action);
        else screenActions.current.delete(route);
      },
    }),
    [phase, listen],
  );

  return (
    <VoiceContext.Provider value={api}>
      {children}
      <VoiceSheet phase={phase} heard={voice.heard} onCancel={cancel} />
    </VoiceContext.Provider>
  );
}
