import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useTensorflowModel,
  type ModelSource,
  type TensorflowModelDelegate,
} from 'react-native-fast-tflite';
import { NitroModules } from 'react-native-nitro-modules';
import { useFrameProcessor } from 'react-native-vision-camera';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import { BusinessRules } from '@/constants/businessRules';
import { COCO_LABELS } from '@/constants/cocoLabels';

import { decodeYoloOutput, nonMaxSuppression, type Detection } from './yoloDecoder';

const INPUT_SIZE = 320; // khớp lúc export model (imgsz=320)
const NUM_CLASSES = COCO_LABELS.length;
const NUM_ANCHORS = 2100; // (320/8)² + (320/16)² + (320/32)²
const IOU_THRESHOLD = 0.45;
/** Frame skipping (CLAUDE.md §9.1): 5 fps tốn khoảng 22%/giờ pin (> 20%) → 3 fps (docs/benchmarks.md). */
const TARGET_INFERENCE_FPS = 3;

export interface FrameResult {
  preprocessMs: number;
  inferenceMs: number;
  postprocessMs: number;
  detections: (Detection & { label: string })[];
}

interface DetectorOptions {
  /** Gọi trên JS thread sau mỗi lần inference. */
  onResult?: (result: FrameResult) => void;
}

const CPU: TensorflowModelDelegate[] = [];

/**
 * Pipeline: frame → cắt vuông giữa + xoay dọc + resize 320×320 RGB float32 (native)
 * → YOLOv8n (TFLite, runSync trong worklet, ngoài JS thread) → decode + NMS → báo về JS.
 */
export function useObstacleDetector(
  source: ModelSource,
  preferredDelegates: TensorflowModelDelegate[],
  { onResult }: DetectorOptions = {},
) {
  // GPU delegate lỗi (máy không có OpenCL…) → tự nạp lại trên CPU (ADR 0001)
  const [gpuFailed, setGpuFailed] = useState(false);
  const delegates = gpuFailed ? CPU : preferredDelegates;
  const plugin = useTensorflowModel(source, delegates);

  // Cập nhật ngay trong render (mẫu "adjusting state" của React) thay vì effect → không render thừa
  if (plugin.state === 'error' && delegates.length > 0 && !gpuFailed) {
    setGpuFailed(true);
  }
  const model = plugin.state === 'loaded' ? plugin.model : undefined;
  // VisionCamera v4 không đọc trực tiếp Nitro HybridObject → box trước khi đưa vào worklet
  const boxedModel = useMemo(() => (model ? NitroModules.box(model) : undefined), [model]);
  const { resize } = useResizePlugin();

  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const reportToJs = useRunOnJS((r: FrameResult) => onResultRef.current?.(r), []);

  // Tự điều tiết FPS: runAtTargetFps của VisionCamera dùng hàm nội bộ không được biên dịch thành
  // worklet (plugin Babel bỏ qua node_modules) → lỗi "getLastFrameProcessorCall cannot be shared".
  const lastRunAt = useSharedValue(0);

  // Shared value của worklets-core được thiết kế để ghi từ worklet → quy tắc React Compiler không áp dụng.
  const frameProcessor = useFrameProcessor(
    // eslint-disable-next-line react-hooks/immutability
    (frame) => {
      'worklet';
      if (boxedModel == null) return;
      const now = Date.now();
      if (now - lastRunAt.value < 1000 / TARGET_INFERENCE_FPS) return;
      // eslint-disable-next-line react-hooks/immutability
      lastRunAt.value = now;
      const tflite = boxedModel.unbox();
      const t0 = Date.now();
      const side = Math.min(frame.width, frame.height);
      const input = resize(frame, {
        crop: {
          x: (frame.width - side) / 2,
          y: (frame.height - side) / 2,
          width: side,
          height: side,
        },
        scale: { width: INPUT_SIZE, height: INPUT_SIZE },
        rotation: frame.width > frame.height ? '90deg' : '0deg',
        pixelFormat: 'rgb',
        dataType: 'float32',
      });
      const t1 = Date.now();
      const outputs = tflite.runSync([
        // resize plugin trả ArrayBuffer thường (không phải SharedArrayBuffer)
        input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer,
      ]);
      const t2 = Date.now();
      const raw = outputs[0];
      if (raw == null) return;
      const kept = nonMaxSuppression(
        decodeYoloOutput(
          new Float32Array(raw),
          NUM_ANCHORS,
          NUM_CLASSES,
          BusinessRules.YOLO_DEFAULT_CONFIDENCE,
          INPUT_SIZE,
        ),
        IOU_THRESHOLD,
        10,
      );
      const t3 = Date.now();
      void reportToJs({
        preprocessMs: t1 - t0,
        inferenceMs: t2 - t1,
        postprocessMs: t3 - t2,
        detections: kept.map((d) => ({ ...d, label: COCO_LABELS[d.classId] ?? 'unknown' })),
      });
    },
    [boxedModel, resize, reportToJs, lastRunAt],
  );

  return {
    frameProcessor,
    modelState: plugin.state,
    usingCpuFallback: gpuFailed,
  };
}
