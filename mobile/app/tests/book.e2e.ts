import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

// Break: the Book shows a confirmed move, but browser SQLite reopens at the previous room.
test('Book keeps a confirmed move across reload', async ({ app, screen }) => {
  await app.clearState();
  await expect(screen.getByRole('button', 'Continue')).toBeVisible();
  await screen.getByRole('button', 'Continue').tap();
  await expect(screen.getByRole('button', 'Look, Ferry Landing')).toBeVisible();

  await screen.getByRole('button', 'Map').tap();
  await screen.getByRole('button', 'Go north').tap();
  await expect(screen.getByRole('button', 'Look, Well Lane')).toBeVisible();

  await app.restart();
  await expect(screen.getByRole('button', 'Continue')).toBeVisible();
  await screen.getByRole('button', 'Continue').tap();
  await expect(screen.getByRole('button', 'Look, Well Lane')).toBeVisible();
});
