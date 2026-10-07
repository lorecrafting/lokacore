import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

// Breaks: Book reload loses an active carrier, or Shoo leaves its exact coin hidden instead of reachable.
test('a held crow coin survives browser reload and Shoo returns it once', async ({
  app,
  screen,
  browser,
}) => {
  await browser.addInitScript(() => {
    const base = Number(localStorage.getItem('d8-proof-base') ?? Date.now());
    localStorage.setItem('d8-proof-base', String(base));
    Date.now = () => base + Number(localStorage.getItem('d8-proof-offset') ?? 0);
    Object.defineProperty(performance, 'now', {
      value: () => Number(localStorage.getItem('d8-proof-offset') ?? 0),
    });
  });
  await app.clearState();
  await browser.reload();
  await screen.getByRole('button', 'Fen-born').tap();
  await screen.getByRole('button', 'Continue').tap();
  const go = async (direction: string) => {
    await screen.getByRole('button', 'Map').tap();
    await screen.getByRole('button', `Go ${direction}`).tap();
  };
  await go('north');
  await go('west');
  await screen.getByRole('button', /Peg Harrow, open/).tap();
  await screen.getByRole('button', 'Buy a torch — 3p').tap();
  await screen.getByRole('button', 'Leave').tap();
  await screen.getByRole('button', /^Contents, Character/).tap();
  await screen.getByRole('button', 'Equipment & Inventory').tap();
  await screen.getByRole('button', 'a torch, open').tap();
  await screen.getByRole('button', 'Ignite a torch').tap();
  await screen.getByRole('button', 'Leave').tap();
  await go('east');
  await go('down');
  await go('down');
  await screen.getByRole('button', 'old coin, open').tap();
  await screen.getByRole('button', 'Take old coin').tap();
  await screen.getByRole('button', 'Surface (free)').tap();
  await go('up');
  await go('north');
  await screen.getByRole('button', /^Contents, Character/).tap();
  await screen.getByRole('button', 'Equipment & Inventory').tap();
  await screen.getByRole('button', 'old coin, open').tap();
  await screen.getByRole('button', 'Drop old coin').tap();
  await browser.evaluate(() => {
    localStorage.setItem('d8-proof-offset', '3000');
    return true;
  });
  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
  const carrier = screen.getByRole(
    'button',
    'a crow, The crow grips an old coin in its beak., open',
  );
  await expect(carrier).toBeVisible();
  await app.screenshot('crow-held-before-refresh');
  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
  await expect(carrier).toBeVisible();
  await app.screenshot('crow-held-after-refresh');
  await carrier.tap();
  await screen.getByRole('button', 'Shoo a crow').tap();
  await expect(screen.getByText('The crow drops the old coin and flies off.')).toBeVisible();
  await expect(screen.getByRole('button', 'Shoo a crow')).not.toBeVisible();
  await screen.getByRole('button', 'Leave').tap();
  await expect(screen.getByRole('button', 'old coin, open')).toBeVisible();
  await expect(carrier).not.toBeVisible();
  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
  await expect(screen.getByRole('button', 'old coin, open')).toBeVisible();
  await expect(carrier).not.toBeVisible();
  await screen.getByRole('button', 'old coin, open').tap();
  await screen.getByRole('button', 'Take old coin').tap();
  await screen.getByRole('button', /^Contents, Character/).tap();
  await screen.getByRole('button', 'Equipment & Inventory').tap();
  await expect(screen.getByRole('button', 'old coin, open')).toBeVisible();
  await app.screenshot('shoo-exact-coin-recovered');
});
