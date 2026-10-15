// The app bundles code outside its folder: the other mobile modules and the kernel.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm'); // expo-sqlite's worker loads wa-sqlite; the web page curl, CanvasKit.
config.resolver.sourceExts.push('sksl');
config.transformer.babelTransformerPath = require.resolve('./sksl-transformer.cjs');
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
} catch {
  delete process.env.EXPO_PUBLIC_KERNEL_COMMIT; // never a stale one: the app reports zero-commit -dirty
}
// Author preview (docs/BUILDERS-GUIDE.md#preview-an-edit): with LOKA_DEV_CARTRIDGE set (`npm run
// author`), App.tsx's chapter import is the artifact `bin/loka dev` writes there. Release, test and
// e2e runs never set it.
if (process.env.LOKA_DEV_CARTRIDGE) {
  const devCartridge = path.resolve(__dirname, process.env.LOKA_DEV_CARTRIDGE);
  if (process.env.NODE_ENV === 'production')
    throw new Error('LOKA_DEV_CARTRIDGE is set: a release bundle must use the pinned chapter');
  if (!fs.existsSync(devCartridge))
    throw new Error(
      `LOKA_DEV_CARTRIDGE (${process.env.LOKA_DEV_CARTRIDGE}) is missing: run bin/loka dev <cartridge dir> first`,
    );
  process.env.EXPO_PUBLIC_LOKA_DEV_CARTRIDGE = '1';
  config.resolver.resolveRequest = (context, name, platform) =>
    context.originModulePath === path.join(__dirname, 'App.tsx') &&
    /\/protocol\/fixtures\/[^/]+\.json$/.test(name)
      ? { type: 'sourceFile', filePath: devCartridge }
      : context.resolveRequest(context, name, platform);
} else delete process.env.EXPO_PUBLIC_LOKA_DEV_CARTRIDGE;
// The transform cache sees neither inlined value: keyed on both, a cached App.tsx never keeps an old one.
config.cacheVersion = `${process.env.EXPO_PUBLIC_KERNEL_COMMIT ?? ''}${process.env.LOKA_DEV_CARTRIDGE ? ':dev' : ''}`;
module.exports = config;
