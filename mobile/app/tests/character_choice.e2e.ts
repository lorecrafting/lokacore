import { beforeEach, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { go, reopen, type Screen, reducedMotion } from './steps.ts';
import { LABEL } from '../book/labels.ts';

// Long walks: the pages cross-fade (steps.ts reducedMotion).
beforeEach(({ browser }) => reducedMotion(browser));

// Breaks: an inherited Swim/Haggle or dark-sight effect is lost in the Book, or a confirmed
// ancestry/value disappears on reload and reopens the once-only picker.
test('authored ancestries keep their chapter effects and choice across browser reload', async ({
  app,
  screen,
}) => {
  for (const [choice, stat] of [
    ['Fen-born', 'PER 6'],
    ['Road-born', 'DEX 11'],
    ['Hill-folk', 'CON 11'],
    ['Fey-touched', 'SPI 11'],
  ] as const) {
    await app.clearState();
    await expect(screen.getByText('Choose your ancestry')).toBeVisible();
    await screen.getByRole('button', choice).tap();
    await screen.getByRole('button', 'Continue').tap();
    await expect(screen.getByRole('button', 'Ferry Landing, look')).toBeVisible();
    await ancestryRoute(screen, choice);
    await screen.getByRole('button', /; opens Contents$/).tap();
    await screen.getByRole('button', 'Character, open').tap();
    await expect(screen.getByText(stat).first()).toBeVisible();
    await reopen({ app, screen });
    await expect(screen.getByRole('button', /, look$/)).toBeVisible();
    await expect(screen.getByText('Choose your ancestry')).not.toBeVisible();
  }
});

// Each ancestry's own effect in the chapter: Fen-born's swim, Road-born's haggle, Hill-folk's dark sight.
async function ancestryRoute(screen: Screen, choice: string) {
  if (choice === 'Fen-born') {
    await go(screen, 'north', 'Well Lane');
    await go(screen, 'down', 'Well Shaft');
    await go(screen, 'down', 'Well Bottom');
    await expect(screen.getByText(/seconds to surface/)).toBeVisible();
  } else if (choice === 'Road-born') {
    await go(screen, 'north', 'Well Lane');
    await go(screen, 'west', 'Chandler');
    await screen.getByRole('button', /^Peg Harrow is here\./).tap();
    await expect(screen.getByText(/a torch: Buy 2p/)).toBeVisible();
    await screen.getByRole('button', 'Buy a torch — 2p').tap();
    await expect(
      screen.getByText('Peg takes your pennies and hands you the purchase.'),
    ).toBeVisible();
    await screen.getByRole('button', LABEL.leave).tap();
  } else if (choice === 'Hill-folk') {
    await go(screen, 'west', 'Boathouse');
    await go(screen, 'south', 'Old Mill');
    await go(screen, 'up', 'Mill Loft');
    await expect(screen.getByText(/An owl watches from the rafters/)).toBeVisible();
  }
}
