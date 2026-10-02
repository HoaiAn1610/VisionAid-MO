import {
  requireOptionalNativeModule,
  type EventSubscription,
  type NativeModule,
} from 'expo-modules-core';

type VolumeKeyEvents = { onLongPress(): void };

// Optional: không có trên iOS / Jest → tính năng tự tắt, không crash
const VolumeKey =
  requireOptionalNativeModule<InstanceType<typeof NativeModule<VolumeKeyEvents>>>('VolumeKey');

/** Nhấn giữ nút giảm âm lượng khi app đang mở (Android). `null` nếu nền tảng không hỗ trợ. */
export function addVolumeLongPressListener(listener: () => void): EventSubscription | null {
  return VolumeKey?.addListener('onLongPress', listener) ?? null;
}
