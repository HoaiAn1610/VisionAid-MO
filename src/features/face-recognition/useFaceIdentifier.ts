import { identifyFace } from '@/api/endpoints/face';
import { Strings } from '@/constants/strings.vi';
import { say, useCaptureAndSpeak } from '@/features/capture/useCaptureAndSpeak';
import { SLOW_NOTICE_MS } from '@/features/ocr/readText';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';

import { describeFaceError, describeIdentification } from './faceSpeech';

/** Khuôn mặt chỉ chiếm một phần ảnh; 1024px đủ cho FaceNet (160×160) và gửi nhanh. */
const FACE_MAX_SIDE = 1024;
const IDENTIFY_TIMEOUT_MS = 10_000;

/** Nhận diện người quen (FE-08, §9.4) — chạy trên server, không có bản offline. */
export function useFaceIdentifier() {
  return useCaptureAndSpeak({
    route: '/face',
    aim: Strings.face.aim,
    maxSide: FACE_MAX_SIDE,
    precheck: () => (NetworkMonitor.isOnline() ? null : Strings.errors.faceNeedsNetwork),
    process: async (image) => {
      const slow = setTimeout(() => say(Strings.face.identifying), SLOW_NOTICE_MS);
      try {
        return describeIdentification(await identifyFace(image, IDENTIFY_TIMEOUT_MS));
      } finally {
        clearTimeout(slow);
      }
    },
    describeError: (e) => describeFaceError(e, NetworkMonitor.isOnline()),
  });
}
