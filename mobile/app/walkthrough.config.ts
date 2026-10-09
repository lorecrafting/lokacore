// `npm run walkthrough`: plays Chapter 1 routes at a phone size under reduced motion and
// screenshots every page for the polish contact sheet (walkthrough/sheet.cjs). Not a test suite.
// `LOKA_WALK=<cartridge id>` plays walkthrough/<id>.walk.ts on the author preview's artifact
// instead (compile it first: `bin/loka dev cartridges/<id>`, docs/BUILDERS-GUIDE.md#preview-an-edit).
import { web } from '@e2e-dev/web';
import type { E2EConfig } from 'e2e';
// @ts-expect-error the app has no Node types; the e2e runner is Node
import { readFileSync } from 'node:fs';

// Port 0: the runner assigns a free port per run, so concurrent runs never share one.
const port = process.env.LOKA_PREVIEW_PORT ?? '0';
const cartridge = process.env.LOKA_WALK || undefined;
if (cartridge) {
  // The route must play the cartridge the preview holds, not a stale `bin/loka dev` build.
  const held = JSON.parse(readFileSync('.dev-cartridge/current.json', 'utf8')) as {
    canonical: string;
  };
  const id = (JSON.parse(held.canonical) as { manifest: { id: string } }).manifest.id;
  if (id !== cartridge)
    throw new Error(
      `LOKA_WALK=${cartridge}, but the author preview holds ${id}: run bin/loka dev cartridges/${cartridge}`,
    );
}

export default {
  tests: [`walkthrough/${cartridge ?? 'chapter1'}.walk.ts`],
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
            LOKA_PREVIEW_PORT: '{port}',
            LOKA_METRO_PORT: process.env.LOKA_METRO_PORT ?? '0',
            ...(cartridge && { LOKA_DEV_CARTRIDGE: '.dev-cartridge/current.json' }),
          },
          startupTimeout: 120_000,
        },
      },
    },
  ],
} satisfies E2EConfig;
