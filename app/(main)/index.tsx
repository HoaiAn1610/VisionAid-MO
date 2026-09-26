import { useEffect } from 'react';

import { A11yText } from '@/components/A11yText';
import { BigActionButton } from '@/components/BigActionButton';
import { Screen } from '@/components/Screen';
import { Strings } from '@/constants/strings.vi';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';

// TODO(Sprint 3): camera feed + radar + obstacle detection pipeline.
export default function HomeScreen() {
  useEffect(() => {
    ttsService.enqueue({ text: Strings.app.ready, priority: TtsPriority.SYSTEM });
  }, []);

  return (
    <Screen>
      <A11yText variant="title">{Strings.home.title}</A11yText>
      <BigActionButton
        label={Strings.home.startNavigation}
        accessibilityHint={Strings.home.startNavigationHint}
        onPress={() =>
          ttsService.enqueue({
            text: Strings.screens.notImplemented,
            priority: TtsPriority.FEEDBACK,
          })
        }
        style={{ flex: 1 }}
      />
    </Screen>
  );
}
