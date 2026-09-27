import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import type { ModelSource, TensorflowModelDelegate } from 'react-native-fast-tflite';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { BusinessRules } from '@/constants/businessRules';
import { Strings } from '@/constants/strings.vi';
import {
  TARGET_INFERENCE_FPS,
  useObstacleDetector,
} from '@/features/obstacle-detection/useObstacleDetector';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { colors, radius, spacing } from '@/theme';

// ponytail: màn hình benchmark chỉ cho bản dev (Sprint 2 — Risk #2); Sprint 3 thay bằng Home thật.
/* eslint-disable @typescript-eslint/no-require-imports -- asset .tflite phải require() để Metro bundle */
const MODELS: { name: string; source: ModelSource }[] = [
  { name: 'float16', source: require('../../assets/models/yolov8n_float16.tflite') },
];
/* eslint-enable @typescript-eslint/no-require-imports */
const DELEGATES: { name: string; value: TensorflowModelDelegate[] }[] = [
  { name: 'CPU', value: [] },
  { name: 'GPU', value: ['android-gpu'] },
  { name: 'NNAPI', value: ['nnapi'] },
];

const fmt = (n: number) => n.toFixed(0);

export default function DetectorLabScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [{ videoResolution: { width: 1280, height: 720 } }]);
  const focused = useIsFocused();
  const [modelIdx, setModelIdx] = useState(0);
  const [delegateIdx, setDelegateIdx] = useState(0);
  const model = MODELS[modelIdx] ?? MODELS[0]!;
  const delegate = DELEGATES[delegateIdx] ?? DELEGATES[0]!;
  const detector = useObstacleDetector(model.source, delegate.value, { fallbackToCpu: false });
  const { stats } = detector;

  const cycle = (kind: 'model' | 'delegate') => {
    detector.resetStats();
    if (kind === 'model') setModelIdx((i) => (i + 1) % MODELS.length);
    else setDelegateIdx((i) => (i + 1) % DELEGATES.length);
  };

  if (!hasPermission) {
    return (
      <Screen>
        <Header title={Strings.lab.title} back />
        <Notice tone="info" icon="camera" message={Strings.lab.permissionExplain} />
        <Button
          icon="camera"
          label={Strings.lab.grantCamera}
          accessibilityHint={Strings.lab.grantCameraHint}
          onPress={() => {
            ttsService.enqueue({
              text: Strings.lab.permissionExplain,
              priority: TtsPriority.FEEDBACK,
            });
            void requestPermission();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header title={Strings.lab.title} back />
      <View style={styles.preview}>
        {device ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            format={format}
            isActive={focused && AppState.currentState === 'active'}
            frameProcessor={detector.frameProcessor}
            pixelFormat="yuv"
          />
        ) : (
          <Notice tone="danger" message={Strings.lab.noCamera} />
        )}
        {/* Model thấy vùng vuông giữa khung → vẽ box trong vùng vuông đó */}
        <View style={styles.square} pointerEvents="none">
          {stats.last?.detections.map((d, i) => (
            <View
              key={i}
              style={[
                styles.box,
                {
                  left: `${d.x * 100}%`,
                  top: `${d.y * 100}%`,
                  width: `${d.w * 100}%`,
                  height: `${d.h * 100}%`,
                },
              ]}
            >
              <ThemedText variant="caption" style={styles.boxLabel}>
                {d.label} {fmt(d.score * 100)}%
              </ThemedText>
            </View>
          ))}
        </View>
      </View>

      {detector.modelState === 'error' && (
        <Notice tone="danger" message={`${Strings.lab.modelError}: ${detector.modelError ?? ''}`} />
      )}

      <View style={styles.stats} accessible>
        <ThemedText variant="label">
          {model.name} · {delegate.name} · {detector.modelState}
        </ThemedText>
        <ThemedText>
          {Strings.lab.inference(fmt(stats.avgInferenceMs), fmt(stats.p95InferenceMs))}
        </ThemedText>
        <ThemedText>
          {Strings.lab.cycle(fmt(stats.avgTotalMs), BusinessRules.YOLO_MAX_INFERENCE_MS)}
        </ThemedText>
        <ThemedText>
          {Strings.lab.fps(stats.achievedFps.toFixed(1), TARGET_INFERENCE_FPS, stats.frames)}
        </ThemedText>
        {stats.last && (
          <ThemedText variant="caption">
            {Strings.lab.stages(stats.last.preprocessMs, stats.last.postprocessMs)} ·{' '}
            {stats.last.detections.map((d) => d.label).join(', ') || '—'}
          </ThemedText>
        )}
        {detector.outputs && (
          <ThemedText variant="caption">
            in {JSON.stringify(detector.inputs?.map((t) => [t.dataType, t.shape]))} · out{' '}
            {JSON.stringify(detector.outputs.map((t) => [t.dataType, t.shape]))}
          </ThemedText>
        )}
      </View>

      <Button
        variant="secondary"
        icon="swap-horizontal"
        label={`${Strings.lab.switchModel}: ${model.name}`}
        accessibilityHint={Strings.lab.switchModelHint}
        onPress={() => cycle('model')}
      />
      <Button
        variant="secondary"
        icon="chip"
        label={`${Strings.lab.switchDelegate}: ${delegate.name}`}
        accessibilityHint={Strings.lab.switchDelegateHint}
        onPress={() => cycle('delegate')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: {
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  square: { position: 'absolute', left: 0, right: 0, aspectRatio: 1, alignSelf: 'center' },
  box: { position: 'absolute', borderWidth: 3, borderColor: colors.primary },
  boxLabel: {
    backgroundColor: colors.primary,
    color: colors.onPrimary,
    paddingHorizontal: spacing.xs,
  },
  stats: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
});
