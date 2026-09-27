import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';

import { A11yText } from '@/components/A11yText';
import { A11yTextInput } from '@/components/A11yTextInput';
import { BigActionButton } from '@/components/BigActionButton';
import { Screen } from '@/components/Screen';
import { Colors } from '@/components/theme';
import { Strings } from '@/constants/strings.vi';
import { loginErrorMessage, useSignIn } from '@/features/auth/useAuthActions';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signIn = useSignIn();

  const submit = () => signIn.mutate({ email, password });

  return (
    <Screen>
      <KeyboardAvoidingView behavior="height" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <A11yText variant="title">{Strings.auth.loginTitle}</A11yText>
          <A11yTextInput
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
          <A11yTextInput
            label={Strings.auth.passwordLabel}
            hint={Strings.auth.passwordHint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          {signIn.isError && (
            <A11yText accessibilityLiveRegion="assertive" style={styles.error}>
              {loginErrorMessage(signIn.error)}
            </A11yText>
          )}
          <BigActionButton
            label={signIn.isPending ? Strings.auth.loggingIn : Strings.auth.loginButton}
            accessibilityHint={Strings.auth.loginHint}
            onPress={submit}
            disabled={signIn.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: 24, paddingBottom: 24 },
  error: { color: Colors.danger, fontWeight: '700' },
});
