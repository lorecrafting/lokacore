// The app bundles code outside its folder: the other mobile modules and the kernel.
const path = require('path');
const { execFileSync } = require('child_process');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [
  path.resolve(__dirname, '..'),
  path.resolve(__dirname, '../../kernel/ts/src'),
  path.resolve(__dirname, '../../protocol/fixtures'),
];
// The kernel version's commit (ADR-075 §3), inlined into the bundle as EXPO_PUBLIC_KERNEL_COMMIT:
// HEAD, with -dirty when the tree has changes (never the bare HEAD then); unset when git fails.
try {
  const git = (...args) =>
    execFileSync('git', ['-C', __dirname, ...args], { encoding: 'utf8' }).trim();
  const dirty = git('status', '--porcelain') !== '';
  process.env.EXPO_PUBLIC_KERNEL_COMMIT = `${git('rev-parse', 'HEAD')}${dirty ? '-dirty' : ''}`;
} catch {}
// The transform cache does not see the stamp: keyed on it, a cached App.tsx never keeps an old one.
config.cacheVersion = process.env.EXPO_PUBLIC_KERNEL_COMMIT ?? '';
module.exports = config;
