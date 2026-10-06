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
  await expect(screen.getByRole('button', 'Look, Ferry Landing')).toBeVisible();
  await screen.getByRole('button', 'Map').tap();
  await screen.getByRole('button', 'Go north').tap();
  await expect(screen.getByRole('button', 'Look, Well Lane')).toBeVisible();
  await screen.getByRole('button', 'Map').tap();
  await screen.getByRole('button', 'Go east').tap();
  await expect(screen.getByRole('button', 'Look, The Drowned Lantern')).toBeVisible();
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

// Break: browser detail routing loses a crossing or lesson, charges the free return, or reload loses confirmed state.
test('paid ferry and free Sedge lesson survive isle exploration, return and browser reload', async ({
  app,
  screen,
}) => {
  const go = async (direction: string, room: string) => {
    await screen.getByRole('button', 'Map').tap();
    await screen.getByRole('button', `Go ${direction}`).tap();
    await expect(screen.getByRole('button', `Look, ${room}`)).toBeVisible();
  };
  const money = () => screen.getByRole('button', /Contents, Character,.*pennies 18 of 1000/);
  await app.clearState();
  await screen.getByRole('button', 'Continue').tap();
  await expect(screen.getByRole('button', 'Look, Ferry Landing')).toBeVisible();
  await go('west', 'Boathouse');
  await screen.getByRole('button', 'Rope ferry').tap();
  await expect(screen.getByText('Fare: 2p.')).toBeVisible();
  await screen.getByRole('button', 'Board — 2p').doubleTap();
  await expect(screen.getByRole('button', 'Look, Fen Isle Landing')).toBeVisible();
  await expect(money()).toBeVisible();
  await go('east', 'Isle Hut');
  await screen.getByRole('button', 'Mother Sedge, open').tap();
  await screen.getByRole('button', 'Learn swim — free Mother Sedge').tap();
  await screen.getByRole('button', 'Learn swim — free').tap();
  await expect(
    screen.getByText('Mother Sedge teaches you to keep afloat and swim. You have learned swim.'),
  ).toBeVisible();
  await expect(money()).toBeVisible();
  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
  await expect(screen.getByRole('button', 'Look, Isle Hut')).toBeVisible();
  await screen.getByRole('button', 'Mother Sedge, open').tap();
  await expect(
    screen.getByText('Mother Sedge teaches you to keep afloat and swim. You have learned swim.'),
  ).toBeVisible();
  await screen.getByRole('button', 'Leave').tap();
  await go('up', 'Hut Loft');
  await go('down', 'Isle Hut');
  await go('east', 'Herb Garden');
  await go('west', 'Isle Hut');
  await go('west', 'Fen Isle Landing');
  await go('south', 'Isle Shrine');
  await go('north', 'Fen Isle Landing');
  await screen.getByRole('button', 'Rope ferry').tap();
  await screen.getByRole('button', 'Return — free').tap();
  await expect(screen.getByRole('button', 'Look, Boathouse')).toBeVisible();
  await expect(money()).toBeVisible();
  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
  await expect(screen.getByRole('button', 'Look, Boathouse')).toBeVisible();
  await expect(money()).toBeVisible();
});
