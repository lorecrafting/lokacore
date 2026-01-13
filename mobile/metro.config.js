const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix CSP eval issues on web
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    ...config.transformer?.minifierConfig,
    compress: {
      ...config.transformer?.minifierConfig?.compress,
      // Avoid constructs that require eval
      reduce_funcs: false,
    },
  },
};

module.exports = config;
