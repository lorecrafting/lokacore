// `npm run walkthrough`: plays Chapter 1 routes at a phone size under reduced motion and
// screenshots every page for the polish contact sheet (walkthrough/sheet.ts). Not a test suite.
import { web } from '@e2e-dev/web';
import type { E2EConfig } from 'e2e';

const port = process.env.LOKA_PREVIEW_PORT ?? '19016';

export default {
  tests: ['walkthrough/*.walk.ts'],
  output: '.walkthrough',
  timeout: 480_000,
  trace: 'off',
  targets: [
    {
      engine: web({
        viewport: { width: 390, height: 844 },
        // As tests/page_turn.e2e.ts: the app reads reduced motion through matchMedia.
        initScripts: [
          () => {
            const media = window.matchMedia.bind(window);
            window.matchMedia = (q) =>
              q.includes('prefers-reduced-motion')
                ? ({ ...media(q), matches: true } as MediaQueryList)
                : media(q);
          },
        ],
      }),
      app: {
        url: `http://127.0.0.1:${port}`,
        command: {
          executable: 'node',
          args: ['preview-server.cjs'],
          env: {
            LOKA_PREVIEW_PORT: port,
            LOKA_METRO_PORT: process.env.LOKA_METRO_PORT ?? '19017',
          },
          startupTimeout: 120_000,
        },
      },
    },
  ],
} satisfies E2EConfig;
