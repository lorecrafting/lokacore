// Homestead hs-7 at 390 px (`LOKA_WALK=gift_sampler npm run walkthrough`): take two pelts and
// trade them to the trader for the knife. Give is not offered in the Book yet (Beads loka-x6t.31).
import { settle, walk } from './walk.ts';

walk('1-barter', 'Barter: two pelts for the knife, no coin', async (r) => {
  const { screen } = r;
  await r.app.clearState();
  await settle();
  for (let i = 0; i < 2; i++) {
    await screen
      .getByRole('button', /^A pelt is here/)
      .first()
      .tap();
    await screen.getByRole('button', 'Take a pelt').tap();
  }
  await screen.getByRole('button', /^The trader is here/).tap();
  await screen.getByRole('button', /Trade two pelts for the knife/).tap();
  await settle();
});
