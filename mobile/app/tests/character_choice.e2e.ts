import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

// Breaks: an inherited Swim/Haggle or dark-sight effect is lost in the Book, or a confirmed
// ancestry/value disappears on reload and reopens the once-only picker.
test('authored ancestries keep their chapter effects and choice across browser reload', async ({
  app,
  screen,
}) => {
  const go = async (direction: string, room: string) => {
    await screen.getByRole('button', 'Map').tap();
    await screen.getByRole('button', `Go ${direction}`).tap();
    await expect(screen.getByRole('button', `Look, ${room}`)).toBeVisible();
  };
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
    await expect(screen.getByRole('button', 'Look, Ferry Landing')).toBeVisible();
    if (choice === 'Fen-born') {
      await go('north', 'Well Lane');
      await go('down', 'Well Shaft');
      await go('down', 'Well Bottom');
      await expect(screen.getByText(/seconds to surface/)).toBeVisible();
    } else if (choice === 'Road-born') {
      await go('north', 'Well Lane');
      await go('west', 'Chandler');
      await screen.getByRole('button', /Peg Harrow, open/).tap();
      await expect(screen.getByText(/a torch: Buy 2p/)).toBeVisible();
      await screen.getByRole('button', 'Buy a torch — 2p').tap();
      await expect(
        screen.getByText('Peg takes your pennies and hands you the purchase.'),
      ).toBeVisible();
      await screen.getByRole('button', 'Leave').tap();
    } else if (choice === 'Hill-folk') {
      await go('west', 'Boathouse');
      await go('south', 'Old Mill');
      await go('up', 'Mill Loft');
      await expect(screen.getByText(/An owl watches from the rafters/)).toBeVisible();
    }
    await screen.getByRole('button', /^Contents, Character/).tap();
    await screen.getByRole('button', 'Character').tap();
    await expect(screen.getByText(stat).first()).toBeVisible();
    await app.restart();
    await screen.getByRole('button', 'Continue').tap();
    await expect(screen.getByRole('button', /^Look,/)).toBeVisible();
    await expect(screen.getByText('Choose your ancestry')).not.toBeVisible();
  }
});
