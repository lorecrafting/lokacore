// Web Storybook for the Book UI (Beads loka-bhb): the real components under react-native-web.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { StorybookConfig } from '@storybook/react-native-web-vite';
import { mergeConfig, type Plugin } from 'vite';

const fromExpo = createRequire(createRequire(import.meta.url).resolve('expo'));
const expoAsset = fromExpo.resolve('expo-asset');

// expo-sqlite's web worker as Metro serves it (SQLiteModule.ts): a module worker Vite transforms,
// its wasm import a URL. ponytail: dev server only; a static build would need the worker bundled.
// Each rewrite throws when its text is gone (an expo-sqlite upgrade), like patch-sqlite-web.cjs.
const rewrite = (src: string, id: string, from: string | RegExp, to: string) => {
  if (src.includes(to.replace('$&', ''))) return src; // the dep pre-bundle already rewrote it
  const out = src.replace(from, to);
  if (out === src) throw new Error(`expo-sqlite-worker: ${id} no longer contains ${from}`);
  return out;
};
const sqliteWorker: Plugin = {
  name: 'expo-sqlite-worker',
  transform: (src, id) =>
    // wa-sqlite.js is an Emscripten UMD file; the worker imports its default
    /expo-sqlite\/web\/wa-sqlite\/wa-sqlite\.js(\?|$)/.test(id)
      ? rewrite(src, id, /^var Module=[^]*$/, '$&\nexport default Module;')
      : /expo-sqlite\/web\/SQLiteModule\.ts(\?|$)/.test(id)
        ? rewrite(
            src,
            id,
            /new Worker\(new URL\((['"])\.\/worker\1, window\.location\.href\)\)/,
            "new Worker('/node_modules/expo-sqlite/web/worker.ts', { type: 'module' })",
          )
        : /expo-sqlite\/web\/worker\.ts(\?|$)/.test(id)
          ? rewrite(
              src,
              id,
              /(['"])\.\/wa-sqlite\/wa-sqlite\.wasm\1/,
              "'./wa-sqlite/wa-sqlite.wasm?url'",
            )
          : undefined,
};

const plugins: Plugin[] = [
  sqliteWorker,
  {
    // Skia's web Platform asks for it only for numeric asset sources; react-native-web has none.
    name: 'asset-registry',
    enforce: 'pre',
    // A config hook after vite-plugin-rnw's, so this alias precedes its react-native one.
    config: () => ({
      resolve: {
        alias: [
          {
            find: /^react-native(-web)?\/Libraries\/Image\/AssetRegistry$/,
            replacement: '@react-native/assets-registry/registry',
          },
          // expo-sqlite's index imports expo-asset (SQLiteProvider), installed only under expo.
          { find: /^expo-asset$/, replacement: expoAsset },
        ],
      },
    }),
  },
  {
    // page-curl.sksl is imported as its text, as sksl-transformer.cjs does for Metro.
    name: 'sksl',
    transform: (src, id) =>
      id.endsWith('.sksl') ? `export default ${JSON.stringify(src)};` : undefined,
  },
];

const config: StorybookConfig = {
  stories: ['../stories/*.mdx', '../stories/*.stories.tsx'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs', '@storybook/addon-vitest'],
  framework: {
    name: '@storybook/react-native-web-vite',
    // Worklets for Reanimated (PageTurn), as babel-preset-expo adds them under Metro.
    options: { pluginReactOptions: { babel: { plugins: ['react-native-worklets/plugin'] } } },
  },
  core: { disableTelemetry: true, disableWhatsNewNotifications: true, crossOriginIsolated: true },
  // The manager chrome uses the Book's fonts too (manager.ts): one font file for both documents.
  managerHead: (head) => head + readFileSync(new URL('preview-head.html', import.meta.url), 'utf8'),
  staticDirs: [{ from: '../book/fonts', to: '/fonts' }],
  viteFinal: (config) =>
    mergeConfig(config, {
      plugins,
      // expo-modules-core's src imports declare-only classes for its global types (Metro drops them).
      optimizeDeps: { rolldownOptions: { shimMissingExports: true, plugins: [sqliteWorker] } },
    }),
};
export default config;
