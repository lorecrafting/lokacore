import { beforeEach, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { begin, go, reopen, type Screen, reducedMotion } from './steps.ts';

// Long walks: the pages cross-fade (steps.ts reducedMotion).
beforeEach(({ browser }) => reducedMotion(browser));

// Break: the Book shows a confirmed move, but browser SQLite reopens at the previous room.
test('Book keeps a confirmed move across reload', async ({ app, screen }) => {
  await begin({ app, screen }, 'Fey-touched');

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
  await begin({ app, screen }, 'Fey-touched');
  await screen.getByRole('button', 'Map').tap();
  await screen.getByRole('button', 'Go north').tap();
  await expect(screen.getByRole('button', 'Look, Well Lane')).toBeVisible();
  await screen.getByRole('button', 'Map').tap();
  await screen.getByRole('button', 'Go east').tap();
  await expect(screen.getByRole('button', 'Look, The Drowned Lantern')).toBeVisible();
  await screen.getByRole('button', /^Widow Maud is here\./).tap();
  await screen.getByRole('button', 'Rent room — 3p').tap();
  await screen.getByRole('button', 'Leave').tap();
  await screen.getByRole('button', 'Map').tap();
  await screen.getByRole('button', 'Go up').tap();
  await screen.getByRole('button', 'Bed, open').tap();
  await screen.getByRole('button', 'Rest').tap();
  await expect(screen.getByRole('button', 'Close')).toBeVisible();
  await screen.getByRole('button', 'Continue').tap();
  await screen.getByRole('button', 'Continue').tap();
  await screen.getByRole('button', 'Continue').tap();
  await expect(screen.getByRole('button', 'Follow the fox')).toBeVisible();
  await expect(screen.getByRole('button', 'Wake')).toBeVisible();

  await reopen({ app, screen });
  await screen.getByRole('button', 'Bed, open').tap();
  await screen.getByRole('button', 'Resume dream').tap();
  await expect(screen.getByRole('button', 'Follow the fox')).toBeVisible();
  await screen.getByRole('button', 'Wake').tap();
  await screen.getByRole('button', 'Acknowledge').tap();
  await expect(screen.getByText('Dream acknowledged.')).toBeVisible();
  await expect(screen.getByText('Rest: not now')).toBeVisible();

  await reopen({ app, screen });
  await screen.getByRole('button', 'Bed, open').tap();
  await expect(screen.getByText('Dream acknowledged.')).toBeVisible();
  await expect(screen.getByText('Rest: not now')).toBeVisible();
});

// Break: browser detail routing loses a crossing or lesson, charges the free return, or reload loses confirmed state.
test('paid ferry and free Sedge lesson survive isle exploration, return and browser reload', async ({
  app,
  screen,
}) => {
  const money = () => screen.getByRole('button', /pennies 18\/1000.*opens Contents, Character$/);
  await begin({ app, screen }, 'Fey-touched');
  await go(screen, 'west', 'Boathouse');
  await screen.getByRole('button', 'Rope ferry, open').tap();
  await expect(screen.getByText('Fare: 2p.')).toBeVisible();
  await screen.getByRole('button', 'Board — 2p').doubleTap();
  await expect(screen.getByRole('button', 'Look, Fen Isle Landing')).toBeVisible();
  await expect(money()).toBeVisible();
  await go(screen, 'east', 'Isle Hut');
  await screen.getByRole('button', /^Mother Sedge is here\./).tap();
  await screen.getByRole('button', 'Learn swim — free Mother Sedge').tap();
  await screen.getByRole('button', 'Learn swim — free').tap();
  await expect(
    screen.getByText('Mother Sedge teaches you to keep afloat and swim. You have learned swim.'),
  ).toBeVisible();
  await expect(money()).toBeVisible();
  await reopen({ app, screen });
  await expect(screen.getByRole('button', 'Look, Isle Hut')).toBeVisible();
  await screen.getByRole('button', /^Mother Sedge is here\./).tap();
  await expect(
    screen.getByText('Mother Sedge teaches you to keep afloat and swim. You have learned swim.'),
  ).toBeVisible();
  await screen.getByRole('button', 'Leave').tap();
  await isleTour(screen);
  await screen.getByRole('button', 'Rope ferry, open').tap();
  await screen.getByRole('button', 'Return — free').tap();
  await expect(screen.getByRole('button', 'Look, Boathouse')).toBeVisible();
  await expect(money()).toBeVisible();
  await reopen({ app, screen });
  await expect(screen.getByRole('button', 'Look, Boathouse')).toBeVisible();
  await expect(money()).toBeVisible();
});

// Every isle room from Isle Hut, ending at the Fen Isle Landing.
async function isleTour(screen: Screen) {
  await go(screen, 'up', 'Hut Loft');
  await go(screen, 'down', 'Isle Hut');
  await go(screen, 'east', 'Herb Garden');
  await go(screen, 'west', 'Isle Hut');
  await go(screen, 'west', 'Fen Isle Landing');
  await go(screen, 'south', 'Isle Shrine');
  await go(screen, 'north', 'Fen Isle Landing');
}
