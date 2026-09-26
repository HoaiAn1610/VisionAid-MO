import { Strings } from '@/constants/strings.vi';

import { A11yText } from './A11yText';
import { Screen } from './Screen';

/** Màn hình tạm cho các tính năng chưa triển khai. */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <Screen>
      <A11yText variant="title">{title}</A11yText>
      <A11yText>{Strings.screens.notImplemented}</A11yText>
    </Screen>
  );
}
