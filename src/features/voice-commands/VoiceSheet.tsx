import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Modal, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { Strings } from '@/constants/strings.vi';
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
 */
export function VoiceSheet({ phase, heard, onCancel }: Props) {
  return (
    <Modal
      visible={phase !== 'idle'}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
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
            variant="secondary"
            icon="close"
            label={Strings.voice.cancel}
            accessibilityHint={Strings.voice.cancelHint}
            onPress={onCancel}
          />
        </View>
      </View>
    </Modal>
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
