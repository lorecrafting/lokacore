// Homestead hs-7 at 390 px (`LOKA_WALK=gift_sampler npm run walkthrough`): take two pelts and
// trade them to the trader for the knife; hs-8: give the apple to the farmer from its page.
import { settle, walk } from './walk.ts';
import { LABEL } from '../book/labels.ts';

walk('1-barter', 'Barter: two pelts for the knife, no coin', async (r) => {
  const { screen } = r;
  await r.app.clearState();
  await settle();
  for (let i = 0; i < 2; i++) {
    await screen
      .getByRole('button', /^A pelt, open$/i)
      .first()
      .tap();
    await screen.getByRole('button', 'Take a pelt').tap();
  }
  await screen.getByRole('button', /^The trader, open$/i).tap();
  await screen.getByRole('button', /Trade two pelts for the knife/).tap();
  await settle();
});

walk('2-give', 'Give: the apple to the farmer from its page', async (r) => {
  const { screen } = r;
  await r.app.clearState();
  await settle();
  await screen
    .getByRole('button', /^An apple, open$/i)
    .first()
    .tap();
  await screen.getByRole('button', 'Take an apple').tap();
  await screen.getByRole('button', /opens Contents/).tap();
  await screen.getByRole('button', new RegExp(`^${LABEL.inventory}`)).tap();
  await screen
    .getByRole('button', /^an apple/)
    .first()
    .tap();
  await settle();
  await screen.getByRole('button', /^Give an apple to the farmer/).tap();
  await settle();
});
