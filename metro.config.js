const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);
const customConfig = {
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts, 'tflite'], 
  },
};


module.exports = mergeConfig(defaultConfig, customConfig);


// const config = {};

// module.exports = mergeConfig(getDefaultConfig(__dirname), config);
