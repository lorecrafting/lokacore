import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

// Break: browser Combat hides the admitted helpers behind the identical hound name.
test('hound Attack shows admitted helpers on the Combat page', async ({ app, screen }) => {
  const go = async (direction: string, room: string) => {
    await screen.getByRole('button', 'Map').tap();
    await screen.getByRole('button', `Go ${direction}`).tap();
    await expect(screen.getByRole('button', `Look, ${room}`)).toBeVisible();
  };
  await app.clearState();
  await screen.getByRole('button', 'Continue').tap();
  await go('south', 'Reed Path');
  await go('south', 'Reed Bank');
  await go('east', 'Hound Run');
  await screen
    .getByRole('button', /a fen hound, open/)
    .first()
    .tap();
  await screen.getByRole('button', /Attack/).tap();
  await expect(screen.getByText('Combat')).toBeVisible();
  await expect(screen.getByText('a fen hound (your target)')).toBeVisible();
  await expect(screen.getByText(/Another fen hound turns to defend its pack/)).toBeVisible();
});
