import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

// Breaks: the Book renders an uncommitted/default ancestry, loses a selected value on browser reload,
// or reopens its once-only picker for an existing run.
test('each authored ancestry is chosen once and survives browser SQLite reload', async ({
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
    await expect(screen.getByRole('button', 'Look, Ferry Landing')).toBeVisible();
    await screen.getByRole('button', /^Contents, Character/).tap();
    await screen.getByRole('button', 'Character').tap();
    await expect(screen.getByText(stat).first()).toBeVisible();
    await app.restart();
    await screen.getByRole('button', 'Continue').tap();
    await expect(screen.getByRole('button', 'Look, Ferry Landing')).toBeVisible();
    await expect(screen.getByText('Choose your ancestry')).not.toBeVisible();
  }
});
