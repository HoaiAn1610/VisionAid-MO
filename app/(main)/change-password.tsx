import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Strings } from '@/constants/strings.vi';
import { passwordErrorMessage, useChangePassword } from '@/features/settings/useSettingsActions';
import { spacing } from '@/theme';

/** Đổi mật khẩu (UC-5). Thành công → server thu hồi mọi phiên → app đăng xuất, đăng nhập lại. */
export default function ChangePasswordScreen() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const change = useChangePassword();
  const submit = () => change.mutate({ current, next, confirm });

  return (
    <Screen scroll>
      <Header title={Strings.password.title} back />
      <View style={styles.form}>
        <TextField
          label={Strings.password.currentLabel}
          hint={Strings.password.currentHint}
          value={current}
          onChangeText={setCurrent}
          secure
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="next"
        />
        <TextField
          label={Strings.password.newLabel}
          hint={Strings.password.newHint}
          value={next}
          onChangeText={setNext}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
        />
        <TextField
          label={Strings.password.confirmLabel}
          hint={Strings.password.confirmHint}
          value={confirm}
          onChangeText={setConfirm}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {/* TTS đã đọc lỗi → không bật live region để TalkBack khỏi đọc trùng */}
        {change.isError && <Notice tone="danger" message={passwordErrorMessage(change.error)} />}
      </View>
      <Button
        icon="lock-reset"
        label={change.isPending ? Strings.password.submitting : Strings.password.submit}
        accessibilityHint={Strings.password.submitHint}
        loading={change.isPending}
        onPress={submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
