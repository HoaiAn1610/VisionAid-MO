import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  type ReadonlyFrameProcessor,
} from 'react-native-vision-camera';

import { Notice } from '@/components/Notice';
import { Strings } from '@/constants/strings.vi';
import { colors, radius } from '@/theme';

interface Props {
  frameProcessor: ReadonlyFrameProcessor;
  /** Chỉ chạy camera khi phiên dẫn đường đang bật. */
  enabled: boolean;
}

/** Camera sau cho YOLO. Tự tắt khi rời màn hình / app xuống nền (pin + quyền riêng tư). */
export function DetectionCamera({ frameProcessor, enabled }: Props) {
  const device = useCameraDevice('back');
  // 720p đủ cho model 320×320, nhẹ hơn 1080p/4K
  const format = useCameraFormat(device, [{ videoResolution: { width: 1280, height: 720 } }]);
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
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        isActive={enabled && focused && foreground}
        frameProcessor={frameProcessor}
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
