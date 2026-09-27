module.exports = function (api) {
  api.cache(true);
  return {
    // Tắt plugin worklets của Reanimated 4 (react-native-worklets): nó được cài kèm như peer của
    // expo-router/VisionCamera và giành biến đổi hàm 'worklet', làm frame processor của
    // react-native-worklets-core báo "cannot be shared". App không dùng Reanimated.
    presets: [['babel-preset-expo', { reanimated: false, worklets: false }]],
    // Biên dịch hàm 'worklet' cho frame processor của VisionCamera 4
    plugins: [['react-native-worklets-core/plugin']],
  };
};
