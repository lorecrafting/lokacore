import { beforeEach, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { reducedMotion } from './steps.ts';
import { LABEL } from '../book/labels.ts';

// Long walks: the pages cross-fade (steps.ts reducedMotion).
beforeEach(({ browser }) => reducedMotion(browser));

// Break: loaded browser Book loses Sedge's lesson, careful alias input, two-herb result or refresh.
test('Sedge lesson leads to careful Harvest and survives browser reload', async ({
  app,
  screen,
}) => {
  const go = async (direction: string, room: string) => {
    await screen.getByRole('button', 'Map').tap();
    await screen.getByRole('button', `Go ${direction}`).tap();
    await expect(screen.getByRole('button', `${room}, look`)).toBeVisible();
  };
  await app.clearState();
  await screen.getByRole('button', 'Fey-touched').tap();
  await screen.getByRole('button', 'Continue').tap();
  await go('west', 'Boathouse');
  await screen.getByRole('button', 'Rope ferry, open').tap();
  await screen.getByRole('button', 'Board — 2p').doubleTap();
  await go('east', 'Isle Hut');
  await screen.getByRole('button', /^Mother Sedge is here\./).tap();
  await screen.getByRole('button', 'Learn herbalism (2p) Mother Sedge').tap();
  await screen.getByRole('button', 'Learn herbalism (2p)').tap();
  await expect(screen.getByText('You pay 2 pennies and learn herbalism.')).toBeVisible();
  await screen.getByRole('button', LABEL.leaveConversation).tap();
  await screen.getByRole('button', LABEL.leave).tap();
  await go('west', 'Fen Isle Landing');
  await screen.getByRole('button', 'Rope ferry, open').tap();
  await screen.getByRole('button', 'Return — free').tap();
  await go('east', 'Ferry Landing');
  await go('south', 'Reed Path');
  await go('south', 'Reed Bank');
  await go('west', 'Willow Shade');
  await screen.getByRole('button', /^Fenwort Patch \(\d+\), open$/).tap();
  await screen.getByRole('button', 'Gather carefully (2 herbs)').tap();
  await expect(screen.getByText('You carefully gather two sprigs of fenwort.')).toBeVisible();
  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
  await expect(screen.getByText('Remaining: 10')).toBeVisible();
  await expect(screen.getByText('You carefully gather two sprigs of fenwort.')).toBeVisible();
});

// Break: Peg's learned Buy quote or paid result differs between shelf, action and reopened Book.
test('Peg lesson discounts an actual purchase after browser reload', async ({ app, screen }) => {
  await app.clearState();
  await screen.getByRole('button', 'Fey-touched').tap();
  await screen.getByRole('button', 'Continue').tap();
  await screen.getByRole('button', 'Map').tap();
  await screen.getByRole('button', 'Go north').tap();
  await screen.getByRole('button', 'Map').tap();
  await screen.getByRole('button', 'Go west').tap();
  await expect(screen.getByRole('button', 'Chandler, look')).toBeVisible();
  await screen.getByRole('button', /^Peg Harrow is here\./).tap();
  await screen.getByRole('button', 'Learn haggle (2p) Peg Harrow').tap();
  await screen.getByRole('button', 'Learn haggle (2p)').tap();
  await expect(screen.getByText('You pay 2 pennies and learn haggle.')).toBeVisible();
  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
  await screen.getByRole('button', /^Peg Harrow is here\./).tap();
  await expect(screen.getByText(/a torch: Buy 2p/)).toBeVisible();
  await screen.getByRole('button', 'Buy a torch — 2p').tap();
  await expect(
    screen.getByText('Peg takes your pennies and hands you the purchase.'),
  ).toBeVisible();
  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
  await screen.getByRole('button', /; opens Contents$/).tap();
  await screen.getByRole('button', 'Equipment & Inventory, open').tap();
  await expect(screen.getByRole('button', 'a torch, open')).toBeVisible();
});
