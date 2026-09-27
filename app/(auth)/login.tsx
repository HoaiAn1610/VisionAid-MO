import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ThemedText } from '@/components/ThemedText';
import { Strings } from '@/constants/strings.vi';
import { loginErrorMessage, useSignIn } from '@/features/auth/useAuthActions';
import { colors, radius, spacing } from '@/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signIn = useSignIn();
  const submit = () => signIn.mutate({ email, password });

  return (
    <Screen scroll>
      <View style={styles.brand} accessible accessibilityRole="header">
        <View style={styles.logo}>
          <MaterialCommunityIcons name="eye-circle" size={56} color={colors.onPrimary} />
        </View>
        <ThemedText variant="display">{Strings.app.name}</ThemedText>
        <ThemedText variant="caption">{Strings.app.tagline}</ThemedText>
      </View>

      <View style={styles.form}>
        <ThemedText variant="title">{Strings.auth.loginTitle}</ThemedText>
        <TextField
          label={Strings.auth.emailLabel}
          hint={Strings.auth.emailHint}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <TextField
          label={Strings.auth.passwordLabel}
          hint={Strings.auth.passwordHint}
          value={password}
          onChangeText={setPassword}
          secure
          autoComplete="password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {/* TTS đã đọc lỗi → không bật live region để TalkBack khỏi đọc trùng */}
        {signIn.isError && <Notice tone="danger" message={loginErrorMessage(signIn.error)} />}
      </View>

      <Button
        label={signIn.isPending ? Strings.auth.loggingIn : Strings.auth.loginButton}
        accessibilityHint={Strings.auth.loginHint}
        icon="login"
        onPress={submit}
        loading={signIn.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  logo: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  form: { gap: spacing.lg, flex: 1 },
});
