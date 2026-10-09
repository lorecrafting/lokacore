// Web Storybook for the Book UI (Beads loka-bhb): the real components under react-native-web.
import type { StorybookConfig } from '@storybook/react-native-web-vite';
import { mergeConfig, type Plugin } from 'vite';

const plugins: Plugin[] = [
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
  stories: ['../stories/*.stories.tsx'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: {
    name: '@storybook/react-native-web-vite',
    // Worklets for Reanimated (PageTurn), as babel-preset-expo adds them under Metro.
    options: { pluginReactOptions: { babel: { plugins: ['react-native-worklets/plugin'] } } },
  },
  staticDirs: [{ from: '../book/fonts', to: '/fonts' }],
  viteFinal: (config) => mergeConfig(config, { plugins }),
};
export default config;
