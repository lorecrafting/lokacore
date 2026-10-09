import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { go, inventory, reopen } from './steps.ts';

// Breaks: the Book loses a visible original deer or cold reopen fails to settle its bound sight flight.
test('a visible deer leaves Willow Shade after the sight deadline and stays gone on reload', async ({
  app,
  screen,
  browser,
}) => {
  await browser.addInitScript(() => {
    const base = Date.now();
    Date.now = () => base + Number(localStorage.getItem('d7-clock-offset') ?? 0);
    Object.defineProperty(performance, 'now', {
      value: () => Number(localStorage.getItem('d7-clock-offset') ?? 0),
    });
  });
  await app.clearState();
  await browser.reload();
  await expect(screen.getByText('Choose your ancestry')).toBeVisible();
  await screen.getByRole('button', 'Fey-touched').tap();
  await screen.getByRole('button', 'Continue').tap();
  await go(screen, 'south', 'Reed Path');
  await go(screen, 'south', 'Reed Bank');
  await go(screen, 'west', 'Willow Shade');
  await expect(screen.getByRole('button', 'a deer, open')).toBeVisible();
  await browser.evaluate(() => {
    localStorage.setItem('d7-clock-offset', String(7_000));
    return true;
  });
  await reopen({ app, screen });
  await expect(screen.getByRole('button', 'Look, Willow Shade')).toBeVisible();
  await expect(screen.getByRole('button', 'a deer, open')).not.toBeVisible();
});

// Breaks: a killed deer shows no original corpse hide or the confirmed Take disappears on Book reload.
test('a killed deer leaves its one hide for a confirmed Take across reload', async ({
  app,
  screen,
  browser,
}) => {
  await browser.addInitScript(() => {
    const base = Date.now();
    Date.now = () => base + Number(localStorage.getItem('d7-kill-offset') ?? 0);
    Object.defineProperty(performance, 'now', {
      value: () => Number(localStorage.getItem('d7-kill-offset') ?? 0),
    });
  });
  await app.clearState();
  await browser.reload();
  await expect(screen.getByText('Choose your ancestry')).toBeVisible();
  await screen.getByRole('button', 'Fey-touched').tap();
  await screen.getByRole('button', 'Continue').tap();
  await go(screen, 'south', 'Reed Path');
  await go(screen, 'south', 'Reed Bank');
  await go(screen, 'west', 'Willow Shade');
  await screen.getByRole('button', 'a deer, open').tap();
  await screen.getByRole('button', /Attack/).tap();
  // The Combat page shows only a confirmed Attack; reopening before it loses the attack.
  await expect(screen.getByText('Combat')).toBeVisible();
  await browser.evaluate(() => {
    localStorage.setItem('d7-kill-offset', String(6_500));
    return true;
  });
  await reopen({ app, screen });
  await expect(screen.getByRole('button', 'Look, Willow Shade')).toBeVisible();
  await expect(screen.getByRole('button', /deer corpse, open/)).toBeVisible();
  await screen.getByRole('button', /deer corpse, open/).tap();
  await expect(screen.getByRole('button', /deer hide, open/)).toBeVisible();
  await screen.getByRole('button', /deer hide, open/).tap();
  await screen.getByRole('button', /Take a deer hide/).tap();
  await reopen({ app, screen });
  await inventory(screen);
  await expect(screen.getByRole('button', 'a deer hide, open')).toBeVisible();
});
