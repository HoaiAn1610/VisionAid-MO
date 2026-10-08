import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Strings } from '@/constants/strings.vi';
import { startEmergencyContactsRefresh } from '@/features/emergency/emergencyContacts';
import { CallOverlay } from '@/features/call/CallOverlay';
import { startCallSignaling, useCallState } from '@/features/call/callService';
import { FallAlertOverlay } from '@/features/emergency/FallAlertOverlay';
import { useFallAlertState } from '@/features/emergency/fallAlertService';
import { preferences } from '@/features/settings/preferencesService';
import { startBatteryMonitor } from '@/services/battery/BatteryMonitor';
import { loadRuntimeConfig } from '@/services/config/runtimeConfig';
import { HapticService } from '@/services/haptics/HapticService';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { useSettingsStore } from '@/stores/settingsStore';
import { useArrivalNotifications } from '@/features/location/useArrivalNotifications';
import { startOfflineSyncLoop } from '@/features/sync/offlineSync';
import { startFcm } from '@/services/fcm/FcmService';
import { VoiceProvider } from '@/features/voice-commands/VoiceProvider';
import { startOnDeviceSpeechSetup } from '@/services/speech/onDeviceSpeech';

export default function MainLayout() {
  // Chỉ chạy khi đã đăng nhập: đồng bộ hàng đợi offline (phiên dẫn đường, voice log…)
  useEffect(() => startOfflineSyncLoop(), []);
  // Config công khai của server (Hybrid, WebRTC…) ghi đè mặc định trong app
  useEffect(() => void loadRuntimeConfig(), []);
  // Tốc độ / âm lượng đọc + chế độ dẫn đường: bản trên máy ngay, rồi đồng bộ server (§9.9)
  useEffect(() => void preferences.load(), []);
  // Danh bạ khẩn cấp vào cache SQLite (mở app + mỗi lần quay lại app) để SOS gọi được cả khi offline
  useEffect(() => startEmergencyContactsRefresh(), []);
  // Pin < 10% → Minimal Mode + báo một lần mỗi lần tụt ngưỡng (BR-17)
  useEffect(
    () =>
      startBatteryMonitor(() => {
        useSettingsStore.getState().setDetectionMode('Minimal');
        ttsService.enqueue({ text: Strings.battery.low, priority: TtsPriority.SYSTEM });
        void HapticService.warning();
      }),
    [],
  );
  // Lệnh giọng nói offline: kiểm tra / tải gói tiếng Việt nhận dạng trên máy (ADR 0002)
  useEffect(() => startOnDeviceSpeechSetup(), []);
  // Thông báo đến nơi quen qua SignalR (ngắt khi rời layout = đăng xuất / hết phiên)
  useArrivalNotifications();
  // FCM: thông báo khi app đang mở + cập nhật token khi Firebase đổi
  useEffect(() => startFcm(), []);
  // Cuộc gọi video với người chăm sóc (WebRTC): nghe signaling qua hub
  useEffect(() => startCallSignaling(), []);

  const fallActive = useFallAlertState().phase === 'countdown';
  const callActive = useCallState().phase !== 'idle';

  return (
    <>
      {/* Đang đếm ngược té ngã: ẩn phần còn lại với TalkBack (accessibilityViewIsModal chỉ có trên iOS) */}
      <View
        style={styles.fill}
        importantForAccessibility={fallActive || callActive ? 'no-hide-descendants' : 'auto'}
      >
        <VoiceProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </VoiceProvider>
      </View>
      <CallOverlay />
      {/* Sau VoiceProvider và cuộc gọi → nằm trên cùng */}
      <FallAlertOverlay />
    </>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
