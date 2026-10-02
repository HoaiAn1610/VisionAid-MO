import {
  requireOptionalNativeModule,
  type EventSubscription,
  type NativeModule,
} from 'expo-modules-core';

type VolumeKeyEvents = { onPress(): void };

interface VolumeKeyModule extends InstanceType<typeof NativeModule<VolumeKeyEvents>> {
  getVolume(): number;
  setVolume(fraction: number): number;
}

// Optional: không có trên iOS / Jest → tính năng tự tắt, không crash
const VolumeKey = requireOptionalNativeModule<VolumeKeyModule>('VolumeKey');

/**
 * Nhấn nút tăng hoặc giảm âm lượng khi app đang mở (Android). Trong lúc có listener, phím âm
 * lượng không còn đổi âm lượng. `null` nếu nền tảng không hỗ trợ.
 */
export function addVolumeKeyListener(listener: () => void): EventSubscription | null {
  return VolumeKey?.addListener('onPress', listener) ?? null;
}

/** Âm lượng media (luồng TTS dùng), 0..1; `null` nếu không hỗ trợ. */
export function getMediaVolume(): number | null {
  return VolumeKey?.getVolume() ?? null;
}

/** Đặt âm lượng media 0..1; trả mức thực tế sau khi làm tròn theo nấc của máy. */
export function setMediaVolume(fraction: number): number | null {
  return VolumeKey?.setVolume(fraction) ?? null;
}
