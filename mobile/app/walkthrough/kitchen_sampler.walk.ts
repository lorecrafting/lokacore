// Homestead hs-13 at 390 px (`LOKA_WALK=kitchen_sampler npm run walkthrough`): catch two fish,
// learn cooking from the cook, cook a hearty stew at the hearth and eat it.
import { moves, settle, walk } from './walk.ts';
import { LABEL } from '../book/labels.ts';

walk('1-kitchen', 'Kitchen: learn cooking, cook a hearty stew at the hearth, eat it', async (r) => {
  const { screen } = r;
  await r.app.clearState();
  await settle();
  await moves(screen, 'north');
  for (let i = 0; i < 2; i++) {
    await screen
      .getByRole('button', /^A fish is here/)
      .first()
      .tap();
    await screen.getByRole('button', 'Take a fish').tap();
  }
  await moves(screen, 'south');
  await screen.getByRole('button', /^The cook is here/).tap();
  await screen.getByRole('button', 'Talk the cook').tap();
  await screen.getByRole('button', 'Learn cooking').tap();
  const leave = () => screen.getByRole('button', /^Leave/).first();
  for (let i = 0; i < 3 && (await settle(), await leave().isVisible()); i++) await leave().tap();
  await screen.getByRole('button', 'Cook a hearty stew').tap();
  await settle();
  await screen.getByRole('button', /opens Contents/).tap();
  await screen.getByRole('button', new RegExp(`^${LABEL.inventory}`)).tap();
  await screen
    .getByRole('button', /hearty stew/)
    .first()
    .tap();
  await screen.getByRole('button', /^Eat/).first().tap();
  await settle();
});
