import { requireOptionalNativeModule } from 'expo-modules-core';

interface PhoneCallModule {
  call(number: string): void;
  dial(number: string): void;
}

// Optional: không có trên iOS / Jest
const PhoneCall = requireOptionalNativeModule<PhoneCallModule>('PhoneCall');

/** Gọi luôn (ACTION_CALL, cần quyền CALL_PHONE). Không dùng cho số khẩn cấp. */
export function placeCall(number: string): void {
  if (!PhoneCall) throw new Error('PhoneCall native module unavailable');
  PhoneCall.call(number);
}

/** Mở trình quay số đã điền sẵn số (ACTION_DIAL) — người dùng tự bấm gọi. */
export function openDialer(number: string): void {
  if (!PhoneCall) throw new Error('PhoneCall native module unavailable');
  PhoneCall.dial(number);
}
