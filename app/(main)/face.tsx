import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Strings } from '@/constants/strings.vi';
import { CaptureView } from '@/features/capture/CaptureView';
import { useFaceIdentifier } from '@/features/face-recognition/useFaceIdentifier';

export default function FaceScreen() {
  const identifier = useFaceIdentifier();

  return (
    <Screen>
      <Header title={Strings.face.title} back />
      <CaptureView
        capture={identifier}
        icon="account-search"
        captureLabel={Strings.face.capture}
        captureHint={Strings.face.captureHint}
        busyLabel={Strings.face.identifying}
        againLabel={Strings.face.again}
        againHint={Strings.face.againHint}
      />
    </Screen>
  );
}
