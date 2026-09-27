// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Model TFLite được bundle như asset (react-native-fast-tflite)
config.resolver.assetExts.push('tflite');

module.exports = config;
