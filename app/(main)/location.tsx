import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { Strings } from '@/constants/strings.vi';
import { useWhereAmI } from '@/features/location/useWhereAmI';
import { colors, radius, spacing } from '@/theme';

export default function LocationScreen() {
  const { message, busy, ask } = useWhereAmI();

  return (
    <Screen scroll>
      <Header title={Strings.location.title} back />
      <View style={styles.result} accessible>
        <ThemedText variant="title">{message ?? Strings.location.locating}</ThemedText>
      </View>
      <Button
        size="hero"
        icon="map-marker-radius"
        label={busy ? Strings.location.locating : Strings.location.again}
        accessibilityHint={Strings.location.againHint}
        loading={busy}
        disabled={busy}
        onPress={() => void ask()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  result: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
});
