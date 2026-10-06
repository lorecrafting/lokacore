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

// Break: Web SQLite or DOM routing loses the scene-owned choice on reload, or final acknowledgment fails to persist.
test('paid Lantern Rest resumes its captured dream choice after browser reload', async ({
  app,
  screen,
}) => {
  await app.clearState();
  await screen.getByRole('button', 'Continue').tap();
  await screen.getByRole('button', 'Map').tap();
  await screen.getByRole('button', 'Go north').tap();
  await screen.getByRole('button', 'Map').tap();
  await screen.getByRole('button', 'Go east').tap();
  await screen.getByRole('button', 'Widow Maud, open').tap();
  await screen.getByRole('button', 'Rent room — 3p').tap();
  await screen.getByRole('button', 'Leave').tap();
  await screen.getByRole('button', 'Map').tap();
  await screen.getByRole('button', 'Go up').tap();
  await screen.getByRole('button', 'Bed').tap();
  await screen.getByRole('button', 'Rest').tap();
  await expect(screen.getByRole('button', 'Close')).toBeVisible();
  await screen.getByRole('button', 'Continue').tap();
  await screen.getByRole('button', 'Continue').tap();
  await screen.getByRole('button', 'Continue').tap();
  await expect(screen.getByRole('button', 'Follow the fox')).toBeVisible();
  await expect(screen.getByRole('button', 'Wake')).toBeVisible();

  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
  await screen.getByRole('button', 'Bed').tap();
  await screen.getByRole('button', 'Resume dream').tap();
  await expect(screen.getByRole('button', 'Follow the fox')).toBeVisible();
  await screen.getByRole('button', 'Wake').tap();
  await screen.getByRole('button', 'Acknowledge').tap();
  await expect(screen.getByText('Dream acknowledged.')).toBeVisible();
  await expect(screen.getByText('Rest: not now')).toBeVisible();

  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
  await screen.getByRole('button', 'Bed').tap();
  await expect(screen.getByText('Dream acknowledged.')).toBeVisible();
  await expect(screen.getByText('Rest: not now')).toBeVisible();
});
