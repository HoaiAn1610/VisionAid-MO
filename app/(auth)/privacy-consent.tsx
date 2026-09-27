import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, type IconName } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { Strings } from '@/constants/strings.vi';
import { useAcceptPrivacy } from '@/features/auth/useAuthActions';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';
import { colors, radius, spacing } from '@/theme';

const pointIcons: Record<keyof typeof Strings.privacy.points, IconName> = {
  location: 'map-marker-radius',
  camera: 'cellphone-screenshot',
  ocr: 'text-recognition',
  face: 'face-recognition',
  fall: 'alert-octagon',
  rights: 'shield-check',
};

const readPolicy = () =>
  ttsService.enqueue({ text: Strings.privacy.content, priority: TtsPriority.INFO });

export default function PrivacyConsentScreen() {
  const accept = useAcceptPrivacy();

  // Audio-first: đọc chính sách ngay khi vào màn hình (UC-20)
  useEffect(() => {
    readPolicy();
  }, []);

  return (
    <Screen>
      <Header title={Strings.privacy.title} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.list}>
        <ThemedText>{Strings.privacy.intro}</ThemedText>
        {(Object.keys(pointIcons) as (keyof typeof pointIcons)[]).map((key) => (
          <View key={key} style={styles.point} accessible>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name={pointIcons[key]} size={28} color={colors.primary} />
            </View>
            <ThemedText style={styles.flex}>{Strings.privacy.points[key]}</ThemedText>
          </View>
        ))}
      </ScrollView>
      <View style={styles.actions}>
        <Button
          variant="secondary"
          icon="volume-high"
          label={Strings.privacy.readAgainButton}
          accessibilityHint={Strings.privacy.readAgainHint}
          onPress={readPolicy}
        />
        <Button
          icon="check-bold"
          label={Strings.privacy.acceptButton}
          accessibilityHint={Strings.privacy.acceptHint}
          onPress={() => accept.mutate()}
          loading={accept.isPending}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: spacing.md, paddingBottom: spacing.md },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: spacing.md },
});
