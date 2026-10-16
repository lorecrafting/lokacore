// Settle S3-1 at 390 px (`LOKA_WALK=settle_sampler npm run walkthrough`): buy the charter from the
// reeve, raise the smithy on the square's stakes, and read the smith's arrival line.
import { LABEL } from '../book/labels.ts';
import { settle, walk } from './walk.ts';

walk('1-charter', 'Settle: buy the charter, raise the smithy, the smith arrives', async (r) => {
  const { screen } = r;
  const tap = async (label: string | RegExp) => {
    await settle();
    await screen.getByRole('button', label).first().tap();
  };
  await r.app.clearState();
  await tap(/^The reeve is here/);
  await tap(/^Buy the charter/);
  await tap(LABEL.leave);
  await tap(/^Raise the smithy/);
  await settle();
});
