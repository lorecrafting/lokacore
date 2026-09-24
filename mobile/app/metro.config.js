// The app bundles code outside its folder: the other mobile modules and the kernel.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '..'), path.resolve(__dirname, '../../kernel/ts/src')];
module.exports = config;
