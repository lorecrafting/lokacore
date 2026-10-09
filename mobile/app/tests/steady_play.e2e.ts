import { beforeEach, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { begin, go, reducedMotion, type Screen } from './steps.ts';

beforeEach(({ browser }) => reducedMotion(browser));

async function saved(screen: Screen, direction: string, room: string) {
  await go(screen, direction, room);
  await expect(screen.getByText('save not confirmed')).not.toBeVisible();
}

// Break: browser SQLite allocates a SharedArrayBuffer per sync call; Chrome runs out of array-buffer
// memory after about 15-30 s of play and the next move is not saved.
test(
  'steady play saves every move with bounded SharedArrayBuffers',
  { timeout: 300_000 },
  async ({ app, screen, browser }) => {
    await browser.addInitScript(() => {
      const Shared = SharedArrayBuffer;
      const counted = globalThis as { sharedBuffers?: number };
      counted.sharedBuffers = 0;
      globalThis.SharedArrayBuffer = new Proxy(Shared, {
        construct(target, args) {
          counted.sharedBuffers! += 1;
          return Reflect.construct(target, args);
        },
      });
    });
    await begin({ app, screen }, 'Fey-touched');
    for (let i = 0; i < 40; i++) {
      await saved(screen, 'north', 'Well Lane');
      await saved(screen, 'south', 'Ferry Landing');
    }
    const made = await browser.evaluate(
      () => (globalThis as { sharedBuffers?: number }).sharedBuffers ?? 0,
    );
    // One lock and one result buffer for the one SQLite worker; upstream made ~430 per move.
    expect(made).toBeGreaterThan(0);
    expect(made).toBeLessThanOrEqual(2);
  },
);
