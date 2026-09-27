import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
/** Frame skipping (CLAUDE.md §9.1): không inference mọi frame để giữ pin. */
export const TARGET_INFERENCE_FPS = 5;

export interface FrameResult {
  preprocessMs: number;
  inferenceMs: number;
  postprocessMs: number;
  detections: (Detection & { label: string })[];
}

export interface DetectorStats {
  frames: number;
  avgInferenceMs: number;
  p95InferenceMs: number;
  avgTotalMs: number;
  achievedFps: number;
  last: FrameResult | null;
}

const EMPTY_STATS: DetectorStats = {
  frames: 0,
  avgInferenceMs: 0,
  p95InferenceMs: 0,
  avgTotalMs: 0,
  achievedFps: 0,
  last: null,
};

const WINDOW = 30;

/**
 * Pipeline: frame → cắt vuông giữa + xoay dọc + resize 320×320 RGB float32 (native)
 * → YOLOv8n (TFLite, runSync trong worklet, ngoài JS thread) → decode + NMS → báo về JS.
 */
interface DetectorOptions {
  /** GPU delegate lỗi (máy không có OpenCL…) → tự nạp lại trên CPU (ADR 0001). Mặc định bật. */
  fallbackToCpu?: boolean;
  /** Gọi trên JS thread sau mỗi lần inference. */
  onResult?: (result: FrameResult) => void;
}

const CPU: TensorflowModelDelegate[] = [];

export function useObstacleDetector(
  source: ModelSource,
  preferredDelegates: TensorflowModelDelegate[],
  { fallbackToCpu = true, onResult }: DetectorOptions = {},
) {
  const [gpuFailed, setGpuFailed] = useState(false);
  const delegates = fallbackToCpu && gpuFailed ? CPU : preferredDelegates;
  const plugin = useTensorflowModel(source, delegates);

  // Cập nhật ngay trong render (mẫu "adjusting state" của React) thay vì effect → không render thừa
  if (plugin.state === 'error' && fallbackToCpu && delegates.length > 0 && !gpuFailed) {
    setGpuFailed(true);
  }
  const model = plugin.state === 'loaded' ? plugin.model : undefined;
  // VisionCamera v4 không đọc trực tiếp Nitro HybridObject → box trước khi đưa vào worklet
  const boxedModel = useMemo(() => (model ? NitroModules.box(model) : undefined), [model]);
  const { resize } = useResizePlugin();

  const [stats, setStats] = useState<DetectorStats>(EMPTY_STATS);
  const samples = useRef<{ at: number; inference: number; total: number }[]>([]);

  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const reportToJs = useRunOnJS((r: FrameResult) => {
    onResultRef.current?.(r);
    const now = Date.now();
    const total = r.preprocessMs + r.inferenceMs + r.postprocessMs;
    const buf = samples.current;
    buf.push({ at: now, inference: r.inferenceMs, total });
    if (buf.length > WINDOW) buf.shift();
    const inf = buf.map((s) => s.inference).sort((a, b) => a - b);
    const spanS = buf.length > 1 ? (now - (buf[0]?.at ?? now)) / 1000 : 0;
    setStats((prev) => ({
      frames: prev.frames + 1,
      avgInferenceMs: inf.reduce((a, b) => a + b, 0) / inf.length,
      p95InferenceMs: inf[Math.min(inf.length - 1, Math.floor(inf.length * 0.95))] ?? 0,
      avgTotalMs: buf.reduce((a, s) => a + s.total, 0) / buf.length,
      achievedFps: spanS > 0 ? (buf.length - 1) / spanS : 0,
      last: r,
    }));
  }, []);

  const resetStats = useCallback(() => {
    samples.current = [];
    setStats(EMPTY_STATS);
  }, []);

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
    stats,
    resetStats,
    modelState: plugin.state,
    usingCpuFallback: fallbackToCpu && gpuFailed,
    modelError: plugin.state === 'error' ? plugin.error.message : undefined,
    inputs: model?.inputs,
    outputs: model?.outputs,
  };
}
