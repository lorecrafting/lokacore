// The self-build route (`LOKA_WALK=craft_sampler npm run walkthrough`, docs/web-preview.md):
// chop, learn carpentry, saw a timbered hut's timber, raise the hut and enter it (hs-12).
import { LABEL } from '../book/labels.ts';
import { moves, scene, settle, walk } from './walk.ts';

walk('1-self-build', 'Self-build: chop, learn carpentry, saw, raise a timbered hut', async (r) => {
  const { screen } = r;
  const tap = async (label: string | RegExp) => {
    await settle();
    await screen.getByRole('button', label).first().tap();
  };
  await r.app.clearState();
  await tap(/^Woodfolk/);
  await scene(screen);
  await tap(/axe/);
  await tap(/^Take/);
  const chop = async () => {
    await moves(screen, 'west');
    await tap('Chop wood');
    await tap('Chop wood');
    await moves(screen, 'east');
  };
  await chop();
  // Carpentry opens at woodcutting 2, and sawing needs it.
  await tap(/^The old carver is here/);
  await screen.getByRole('button', 'Talk the old carver').last().tap();
  await tap('Learn carpentry');
  await tap(LABEL.leaveConversation);
  await tap(LABEL.leave);
  await tap('Saw timber');
  await chop();
  await tap('Saw timber');
  await moves(screen, 'east');
  await tap('Raise a timbered hut');
  await moves(screen, 'north');
});
