import type { RefObject } from 'react';
import type { Camera } from 'react-native-vision-camera';

import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { logger } from '@/utils/logger';

/** Ảnh hiện trường nhỏ: đủ để người chăm sóc nhận ra nơi té ngã, gửi nhanh trên mạng di động. */
const MAX_SIDE = 480;
const QUALITY = 0.5;

let camera: RefObject<Camera | null> | null = null;

/** Camera dẫn đường đăng ký để chụp ảnh khi té ngã. Trả hàm hủy đăng ký. */
export function registerFallSnapshotCamera(ref: RefObject<Camera | null>): () => void {
  camera = ref;
  return () => {
    if (camera === ref) camera = null;
  };
}

function deleteQuietly(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (e) {
    logger.warn('Delete snapshot file failed', e);
  }
}

/**
 * Chụp khung hình preview lúc té ngã → JPEG nhỏ, base64. Chỉ giữ trong bộ nhớ, file tạm xóa ngay.
 * Không có camera / lỗi → null (cảnh báo vẫn gửi bình thường, chỉ thiếu ảnh).
 */
export async function captureFallSnapshot(): Promise<string | null> {
  const cam = camera?.current;
  if (!cam) return null;
  const files: string[] = [];
  try {
    // Android: chụp lại view preview — không cần bật chế độ chụp ảnh của camera dẫn đường
    const shot = await cam.takeSnapshot({ quality: 80 });
    const source = `file://${shot.path}`;
    files.push(source);
    const context = ImageManipulator.manipulate(source);
    try {
      let image = await context.renderAsync();
      const scale = MAX_SIDE / Math.max(image.width, image.height);
      if (scale < 1) {
        image.release();
        image = await context.resize({ width: Math.round(image.width * scale) }).renderAsync();
      }
      const saved = await image.saveAsync({
        compress: QUALITY,
        format: SaveFormat.JPEG,
        base64: true,
      });
      image.release();
      files.push(saved.uri);
      return saved.base64 ?? null;
    } finally {
      context.release();
    }
  } catch (e) {
    logger.warn('Fall snapshot failed', e);
    return null;
  } finally {
    files.forEach(deleteQuietly);
  }
}
