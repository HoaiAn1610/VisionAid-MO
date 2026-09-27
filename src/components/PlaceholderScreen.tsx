import { Strings } from '@/constants/strings.vi';

import { Header } from './Header';
import { Notice } from './Notice';
import { Screen } from './Screen';

/** Màn hình tạm cho các tính năng chưa triển khai. */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <Screen>
      <Header title={title} back />
      <Notice tone="info" icon="progress-wrench" message={Strings.screens.notImplemented} />
    </Screen>
  );
}
