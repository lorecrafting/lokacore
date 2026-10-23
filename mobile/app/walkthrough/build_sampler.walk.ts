// Built rooms S5 at 390 px (`LOKA_WALK=build_sampler npm run walkthrough`): buy the plot, raise
// the hut (7200 s at rate 50, about 2.5 minutes), leave a timber on its floor, then raze it: the
// timber lies in the lane and north is gone.
import { moves, settle, walk } from './walk.ts';
import { LABEL } from '../book/labels.ts';

walk('1-raze', 'Build: buy the plot, raise a hut, drop a timber in it, raze it', async (r) => {
  const { screen } = r;
  const tap = async (label: string | RegExp) => {
    await settle();
    await screen.getByRole('button', label).first().tap();
  };
  const take = async () => {
    await tap(/^A length of timber, open$/i);
    await tap(/^Take a length of timber/);
  };
  await r.app.clearState();
  await tap(/^The seller, open$/i);
  await tap(/^Buy the plot/);
  await tap(LABEL.leave);
  await take();
  await take();
  await tap(/^The carpenter, open$/i);
  await tap(/^Raise a hut/);
  await tap(LABEL.leave);
  await new Promise((done) => setTimeout(done, 160_000));
  await take();
  await moves(screen, 'north');
  await tap(/opens Contents/);
  await tap(new RegExp(`^${LABEL.inventory}`));
  await tap(/timber/);
  await tap(/^Drop/);
  await settle();
  await moves(screen, 'south');
  await tap(/^The carpenter, open$/i);
  await tap(/^Raze the hut/);
  await tap(LABEL.leave);
  await settle();
});
