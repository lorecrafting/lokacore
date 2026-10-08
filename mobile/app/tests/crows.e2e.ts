import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { go, inventory, litTorch, reopen, type Screen } from './steps.ts';

// Breaks: Book reload loses an active carrier, or Shoo leaves its exact coin hidden instead of reachable.
test('a held crow coin survives browser reload and Shoo returns it once', async ({
  app,
  screen,
  browser,
}) => {
  await browser.addInitScript(offsetClock);
  await app.clearState();
  await browser.reload();
  await screen.getByRole('button', 'Fen-born').tap();
  await screen.getByRole('button', 'Continue').tap();
  await dropWellCoin(screen);
  await browser.evaluate(() => {
    localStorage.setItem('d8-proof-offset', '3000');
    return true;
  });
  await reopen({ app, screen });
  const carrier = screen.getByRole(
    'button',
    'a crow, The crow grips an old coin in its beak., open',
  );
  await expect(carrier).toBeVisible();
  await app.screenshot('crow-held-before-refresh');
  await reopen({ app, screen });
  await expect(carrier).toBeVisible();
  await app.screenshot('crow-held-after-refresh');
  await shoo(screen, carrier);
  await screen.getByRole('button', 'Leave').tap();
  await expect(screen.getByRole('button', 'old coin, open')).toBeVisible();
  await expect(carrier).not.toBeVisible();
  await reopen({ app, screen });
  await expect(screen.getByRole('button', 'old coin, open')).toBeVisible();
  await expect(carrier).not.toBeVisible();
  await screen.getByRole('button', 'old coin, open').tap();
  await screen.getByRole('button', 'Take old coin').tap();
  await inventory(screen);
  await expect(screen.getByRole('button', 'old coin, open')).toBeVisible();
  await app.screenshot('shoo-exact-coin-recovered');
});

// Shoo makes the crow drop the coin and leaves no second Shoo.
async function shoo(screen: Screen, carrier: ReturnType<Screen['getByRole']>) {
  await carrier.tap();
  await screen.getByRole('button', 'Shoo a crow').tap();
  await expect(screen.getByText('The crow drops the old coin and flies off.')).toBeVisible();
  await expect(screen.getByRole('button', 'Shoo a crow')).not.toBeVisible();
}

// A clock the test advances through localStorage, kept across reloads.
function offsetClock() {
  const base = Number(localStorage.getItem('d8-proof-base') ?? Date.now());
  localStorage.setItem('d8-proof-base', String(base));
  Date.now = () => base + Number(localStorage.getItem('d8-proof-offset') ?? 0);
  Object.defineProperty(performance, 'now', {
    value: () => Number(localStorage.getItem('d8-proof-offset') ?? 0),
  });
}

// From the Ferry Landing: light a torch, take the Well Bottom coin and drop it on Well Lane.
async function dropWellCoin(screen: Screen) {
  await go(screen, 'north');
  await go(screen, 'west');
  await litTorch(screen);
  await go(screen, 'east');
  await go(screen, 'down');
  await go(screen, 'down');
  await screen.getByRole('button', 'old coin, open').tap();
  await screen.getByRole('button', 'Take old coin').tap();
  await screen.getByRole('button', 'Surface (free)').tap();
  await go(screen, 'up');
  await go(screen, 'north');
  await inventory(screen);
  await screen.getByRole('button', 'old coin, open').tap();
  await screen.getByRole('button', 'Drop old coin').tap();
}
