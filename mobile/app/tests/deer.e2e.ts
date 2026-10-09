import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { go, inventory, reopen } from './steps.ts';

// In the page: both clocks read the offset (ms) stored at `key`, so game time passes only when a
// test sets it. With `seed`, the new game's seed is that fixed mulberry32 stream, not a drawn one.
const clocks = ({ key, seed }: { key: string; seed?: number }) => {
  const base = Date.now();
  Date.now = () => base + Number(localStorage.getItem(key) ?? 0);
  Object.defineProperty(performance, 'now', {
    value: () => Number(localStorage.getItem(key) ?? 0),
  });
  if (seed === undefined) return;
  let s = seed;
  crypto.getRandomValues = <T extends ArrayBufferView | null>(a: T) => {
    const words = a as unknown as Uint32Array;
    for (let i = 0; i < words.length; i++) {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      words[i] = (t ^ (t >>> 14)) >>> 0;
    }
    return a;
  };
};

// Breaks: the Book loses a visible original deer or cold reopen fails to settle its bound sight flight.
test('a visible deer leaves Willow Shade after the sight deadline and stays gone on reload', async ({
  app,
  screen,
  browser,
}) => {
  await browser.addInitScript(clocks, { key: 'd7-clock-offset' });
  await app.clearState();
  await browser.reload();
  await expect(screen.getByText('Choose your ancestry')).toBeVisible();
  await screen.getByRole('button', 'Fey-touched').tap();
  await screen.getByRole('button', 'Continue').tap();
  await go(screen, 'south', 'Reed Path');
  await go(screen, 'south', 'Reed Bank');
  await go(screen, 'west', 'Willow Shade');
  await expect(screen.getByRole('button', 'A deer is here., open')).toBeVisible();
  await browser.evaluate(() => {
    localStorage.setItem('d7-clock-offset', String(7_000));
    return true;
  });
  await reopen({ app, screen });
  await expect(screen.getByRole('button', 'Look, Willow Shade')).toBeVisible();
  await expect(screen.getByRole('button', 'A deer is here., open')).not.toBeVisible();
});

// Breaks: a killed deer shows no original corpse hide or the confirmed Take disappears on Book reload.
test('a killed deer leaves its one hide for a confirmed Take across reload', async ({
  app,
  screen,
  browser,
}) => {
  // The new game's seed decides the fight: rounds at +150 s and +300 s each hit the 1-hp deer
  // at 75%, and at its +300 s sight deadline it bounds south even mid-fight, so two misses
  // (21 of 400 drawn seeds) failed the run. A fixed mulberry32 stream makes the seed the same
  // every run: stream 1 kills, stream 16 misses twice and shows 'The deer bounds south.'.
  await browser.addInitScript(clocks, { key: 'd7-kill-offset', seed: 1 });
  await app.clearState();
  await browser.reload();
  await expect(screen.getByText('Choose your ancestry')).toBeVisible();
  await screen.getByRole('button', 'Fey-touched').tap();
  await screen.getByRole('button', 'Continue').tap();
  await go(screen, 'south', 'Reed Path');
  await go(screen, 'south', 'Reed Bank');
  await go(screen, 'west', 'Willow Shade');
  await screen.getByRole('button', 'A deer is here., open').tap();
  await screen.getByRole('button', /Attack/).tap();
  // The Combat page shows only a confirmed Attack; reopening before it loses the attack.
  await expect(screen.getByText('Combat')).toBeVisible();
  await browser.evaluate(() => {
    localStorage.setItem('d7-kill-offset', String(6_500));
    return true;
  });
  await reopen({ app, screen });
  await expect(screen.getByRole('button', 'Look, Willow Shade')).toBeVisible();
  await expect(screen.getByRole('button', /deer corpse is here\./)).toBeVisible();
  await screen.getByRole('button', /deer corpse is here\./).tap();
  await expect(screen.getByRole('button', /deer hide, open/)).toBeVisible();
  await screen.getByRole('button', /deer hide, open/).tap();
  await screen.getByRole('button', /Take a deer hide/).tap();
  await reopen({ app, screen });
  await inventory(screen);
  await expect(screen.getByRole('button', 'a deer hide, open')).toBeVisible();
});
