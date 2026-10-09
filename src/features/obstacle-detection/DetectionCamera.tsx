import { useIsFocused } from 'expo-router';
import { useEffect, useState, type Ref } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  type CodeScanner,
  type ReadonlyFrameProcessor,
} from 'react-native-vision-camera';

import { Notice } from '@/components/Notice';
import { Strings } from '@/constants/strings.vi';
import { logger } from '@/utils/logger';
import { useCameraHeldByCall, useCameraUser } from '@/features/call/cameraHold';
import { colors, radius } from '@/theme';

interface Props {
  /** YOLO (dẫn đường). */
  frameProcessor?: ReadonlyFrameProcessor;
  /** Quét mã QR on-device (ML Kit). */
  codeScanner?: CodeScanner;
  /** Chụp ảnh tĩnh (đọc chữ, nhận diện người quen) qua `cameraRef.current.takePhoto()`. */
  cameraRef?: Ref<Camera>;
  /** Chỉ cần `takeSnapshot` (ảnh té ngã) — không bật chế độ chụp ảnh, giữ format nhẹ cho YOLO. */
  snapshotOnly?: boolean;
  /** Chỉ chạy camera khi đang cần (phiên dẫn đường / đang quét). */
  enabled: boolean;
}

/** Camera sau cho YOLO / quét QR / chụp ảnh. Tự tắt khi rời màn hình / app xuống nền (pin + quyền riêng tư). */
export function DetectionCamera({
  frameProcessor,
  codeScanner,
  cameraRef,
  snapshotOnly = false,
  enabled,
}: Props) {
  const photo = cameraRef !== undefined && !snapshotOnly;
  const device = useCameraDevice('back');
  // 720p đủ cho model 320×320, nhẹ hơn 1080p/4K. Chụp ảnh: ~1080p đủ cho OCR, ảnh vẫn được nén lại.
  const format = useCameraFormat(device, [
    { videoResolution: { width: 1280, height: 720 } },
    ...(photo ? [{ photoResolution: { width: 1920, height: 1080 } }] : []),
  ]);
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  // Cuộc gọi video với người chăm sóc dùng camera sau → tạm nhường (§9.10)
  const heldByCall = useCameraHeldByCall();
  const running = enabled && focused && foreground && !heldByCall;
  useCameraUser(running);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);

  if (!device) return <Notice tone="danger" message={Strings.navigation.cameraUnavailable} />;

  return (
    <View style={styles.frame} importantForAccessibility="no-hide-descendants">
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        isActive={running}
        frameProcessor={frameProcessor}
        codeScanner={codeScanner}
        photo={photo}
        pixelFormat="yuv"
        // Lỗi camera (bị app khác chiếm, phần cứng…): người dùng được báo qua bộ canh khung hình
        onError={(e) => logger.warn('Camera error', e.code)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    minHeight: 200,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
});
