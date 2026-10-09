import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { Strings } from '@/constants/strings.vi';
import { useAccessibilityFocusOnShow } from '@/services/a11y/screenReader';
import { colors, radius, spacing } from '@/theme';

import type { VoicePhase } from './useVoiceCommand';

interface Props {
  phase: VoicePhase;
  heard: string | null;
  onCancel(): void;
}

/**
 * Voice Listening Bottom Sheet (FE-09). Trạng thái đã được TTS + tiếng bíp báo, nên phần chữ ẩn
 * với TalkBack — chỉ còn nút Hủy để TalkBack không đọc đè lên lúc mic đang nghe (§5.7).
 * Lớp phủ trong cửa sổ chính, KHÔNG dùng `Modal`: Modal là Dialog riêng, phím âm lượng đi vào
 * Dialog nên không bấm được để hủy (modules/volume-key chỉ nhận phím của Activity).
 */
export function VoiceSheet({ phase, heard, onCancel }: Props) {
  const visible = phase !== 'idle';
  const cancelRef = useRef<View>(null);
  useAccessibilityFocusOnShow(cancelRef, visible);

  // Nút Back khi đang nghe = Hủy
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [visible, onCancel]);

  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.status} importantForAccessibility="no-hide-descendants">
            <MaterialCommunityIcons name="microphone" size={64} color={colors.primary} />
            <ThemedText variant="title">
              {phase === 'confirming' ? Strings.voice.confirming : Strings.voice.listening}
            </ThemedText>
            {heard ? <ThemedText variant="body">“{heard}”</ThemedText> : null}
          </View>
          <Button
            ref={cancelRef}
            variant="secondary"
            icon="close"
            label={Strings.voice.cancel}
            accessibilityHint={Strings.voice.cancelHint}
            onPress={onCancel}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  status: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
});
