import { web } from '@e2e-dev/web';
import type { E2EConfig } from 'e2e';

export default {
  targets: [
    {
      engine: web(),
      app: {
        url: 'http://127.0.0.1:19106',
        // Ready once Metro has built the app's lazy bundle (the request the page makes), not when
        // the HTML answers: a cold build left the first test's page blank past its assertion.
        // ponytail: copied from the page's request; the runner counts a 404 as ready, so after an
        // Expo upgrade check that `command ready` still takes seconds, not under one.
        readyUrl:
          'http://127.0.0.1:19106/web-app.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable&modulesOnly=true&runModule=false',
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
