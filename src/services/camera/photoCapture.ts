import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { Camera } from 'react-native-vision-camera';

import type { UploadImage } from '@/api/endpoints/ocr';
import { logger } from '@/utils/logger';

/** Xóa ảnh tạm; không bao giờ ném lỗi (dùng trong `finally`, BR-22). */
export function deletePhoto(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (e) {
    logger.warn('Delete photo failed', e);
  }
}

/**
 * Chụp ảnh rồi nén JPEG, cạnh dài tối đa `maxSide` (§16.13). Ảnh gốc bị xóa ngay; người gọi phải
 * `deletePhoto` ảnh trả về trong `finally`.
 */
export async function captureJpeg(camera: Camera, maxSide: number): Promise<UploadImage> {
  const photo = await camera.takePhoto();
  const source = `file://${photo.path}`;
  const context = ImageManipulator.manipulate(source);
  try {
    let image = await context.renderAsync();
    const scale = maxSide / Math.max(image.width, image.height);
    if (scale < 1) {
      const width = Math.round(image.width * scale);
      image.release();
      image = await context.resize({ width }).renderAsync();
    }
    const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
    image.release();
    return { uri: saved.uri, name: 'photo.jpg', type: 'image/jpeg' };
  } finally {
    context.release();
    deletePhoto(source);
  }
}
