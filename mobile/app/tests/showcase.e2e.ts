// The bundled chapter is the toolbox showcase (docs/decisions/README.md): its Book
// keeps a confirmed move across reload, every move saved, and Start over back at the inn.
import { beforeEach, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { go, reducedMotion, type Screen } from './steps.ts';
import { LABEL } from '../book/labels.ts';

beforeEach(({ browser }) => reducedMotion(browser));

async function saved(screen: Screen, direction: string, room: string) {
  await go(screen, direction, room);
  await expect(screen.getByText('save not confirmed')).not.toBeVisible();
}

// Breaks: browser SQLite reopens at the previous room after a confirmed move, or Start over keeps
// the old game (or is not saved, so a reload brings it back).
test('a confirmed move survives reload and Start over returns to the inn', async ({
  app,
  screen,
  browser,
}) => {
  await app.clearState();
  await expect(screen.getByRole('button', 'Crossroads Inn, look')).toBeVisible();
  await saved(screen, 'north', 'Fell Gate');

  await app.restart();
  await expect(screen.getByRole('button', 'Fell Gate, look')).toBeVisible();

  await browser.onDialog('accept'); // the shell's Start over confirm
  await screen.getByRole('button', /; opens Contents$/).tap();
  await screen.getByRole('button', 'Settings, open').tap();
  await screen.getByRole('button', LABEL.startOver).tap();
  await expect(screen.getByRole('button', 'Crossroads Inn, look')).toBeVisible();

  await app.restart();
  await expect(screen.getByRole('button', 'Crossroads Inn, look')).toBeVisible();
});

// Breaks: browser SQLite allocates a SharedArrayBuffer per sync call; Chrome runs out of
// array-buffer memory after about 15-30 s of play and the next move is not saved.
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
    await app.clearState();
    await expect(screen.getByRole('button', 'Crossroads Inn, look')).toBeVisible();
    for (let i = 0; i < 40; i++) {
      await saved(screen, 'north', 'Fell Gate');
      await saved(screen, 'south', 'Crossroads Inn');
    }
    const made = await browser.evaluate(
      () => (globalThis as { sharedBuffers?: number }).sharedBuffers ?? 0,
    );
    // One lock and one result buffer for the one SQLite worker; upstream made ~430 per move.
    expect(made).toBeGreaterThan(0);
    expect(made).toBeLessThanOrEqual(2);
  },
);
