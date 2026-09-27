// Không autolink native của Reanimated 4 / react-native-worklets: chúng chỉ được cài kèm như peer của
// expo-router và VisionCamera, app không dùng. Nếu để lại, runtime worklet của chúng xung đột với
// react-native-worklets-core (VisionCamera 4 frame processor) — xem ADR 0001 §4.
module.exports = {
  dependencies: {
    'react-native-reanimated': { platforms: { android: null, ios: null } },
    'react-native-worklets': { platforms: { android: null, ios: null } },
  },
};
