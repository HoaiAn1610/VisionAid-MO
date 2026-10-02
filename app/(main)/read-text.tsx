import { useLocalSearchParams } from 'expo-router';

import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Strings } from '@/constants/strings.vi';
import { CaptureView } from '@/features/capture/CaptureView';
import { useTextReader } from '@/features/ocr/useTextReader';

export default function ReadTextScreen() {
  const { via } = useLocalSearchParams<{ via?: string }>();
  const reader = useTextReader(via === 'voice' ? 'VoiceCommand' : 'Tap');

  return (
    <Screen>
      <Header title={Strings.ocr.title} back />
      <CaptureView
        capture={reader}
        icon="text-recognition"
        captureLabel={Strings.ocr.capture}
        captureHint={Strings.ocr.captureHint}
        busyLabel={Strings.ocr.reading}
        againLabel={Strings.ocr.again}
        againHint={Strings.ocr.againHint}
      />
    </Screen>
  );
}
