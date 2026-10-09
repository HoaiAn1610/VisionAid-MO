import { useEffect, useSyncExternalStore } from 'react';

/**
 * Một camera sau, hai người dùng: dẫn đường (VisionCamera + YOLO) và cuộc gọi video (WebRTC).
 * Cuộc gọi "giữ" camera → mọi DetectionCamera tự tắt; hết cuộc gọi thì bật lại.
 */
let held = false;
let activeUsers = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** VisionCamera cần một chút thời gian để đóng phiên camera trước khi WebRTC mở. */
const RELEASE_DELAY_MS = 400;

export const cameraHold = {
  /** Giữ camera cho cuộc gọi. Trả về true nếu lúc đó camera dẫn đường đang chạy (để báo bật lại). */
  async hold(): Promise<boolean> {
    const wasInUse = activeUsers > 0;
    if (!held) {
      held = true;
      emit();
    }
    if (wasInUse) await new Promise((r) => setTimeout(r, RELEASE_DELAY_MS));
    return wasInUse;
  },
  release(): void {
    if (!held) return;
    held = false;
    emit();
  },
  isHeld: () => held,
};

export function useCameraHeldByCall(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => held,
  );
}

/** DetectionCamera báo đang dùng camera (để biết có cần báo "đã bật lại cảnh báo vật cản"). */
export function useCameraUser(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    activeUsers++;
    return () => {
      activeUsers--;
    };
  }, [active]);
}
