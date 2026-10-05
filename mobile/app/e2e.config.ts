import { web } from '@e2e-dev/web';
import type { E2EConfig } from 'e2e';

export default {
  targets: [
    {
      engine: web(),
      app: {
        url: 'http://127.0.0.1:19106',
        command: {
          executable: 'node',
          args: ['preview-server.cjs'],
          env: { LOKA_PREVIEW_PORT: '19106', LOKA_METRO_PORT: '19107' },
          startupTimeout: 120_000,
        },
      },
    },
  ],
} satisfies E2EConfig;
