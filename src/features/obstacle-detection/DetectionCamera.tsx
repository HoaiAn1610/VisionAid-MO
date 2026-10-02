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
import { colors, radius } from '@/theme';

interface Props {
  /** YOLO (dẫn đường). */
  frameProcessor?: ReadonlyFrameProcessor;
  /** Quét mã QR on-device (ML Kit). */
  codeScanner?: CodeScanner;
  /** Chụp ảnh tĩnh (đọc chữ, nhận diện người quen) qua `cameraRef.current.takePhoto()`. */
  cameraRef?: Ref<Camera>;
  /** Chỉ chạy camera khi đang cần (phiên dẫn đường / đang quét). */
  enabled: boolean;
}

/** Camera sau cho YOLO / quét QR / chụp ảnh. Tự tắt khi rời màn hình / app xuống nền (pin + quyền riêng tư). */
export function DetectionCamera({ frameProcessor, codeScanner, cameraRef, enabled }: Props) {
  const device = useCameraDevice('back');
  // 720p đủ cho model 320×320, nhẹ hơn 1080p/4K. Chụp ảnh: ~1080p đủ cho OCR, ảnh vẫn được nén lại.
  const format = useCameraFormat(device, [
    { videoResolution: { width: 1280, height: 720 } },
    ...(cameraRef ? [{ photoResolution: { width: 1920, height: 1080 } }] : []),
  ]);
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

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
        isActive={enabled && focused && foreground}
        frameProcessor={frameProcessor}
        codeScanner={codeScanner}
        photo={cameraRef !== undefined}
        pixelFormat="yuv"
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
