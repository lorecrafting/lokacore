// The self-build route (`LOKA_WALK=craft_sampler npm run walkthrough`, docs/web-preview.md):
// chop, learn carpentry, saw a timbered hut's timber, raise the hut and enter it (hs-12); then
// the Character page's skill tree before and after learning carving (hs-14).
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
    await tap('oak, open'); // a recipe aimed at a detail is on its page (loka-x6t.120)
    await tap('Chop wood');
    await tap('Chop wood');
    await tap(LABEL.leave);
    await moves(screen, 'east');
  };
  await chop();
  // Carpentry opens at woodcutting 2, and sawing needs it.
  await tap(/^The old carver, open$/i);
  await screen.getByRole('button', 'Talk the old carver').last().tap();
  await tap('Learn carpentry');
  await tap(LABEL.leaveConversation);
  await tap(LABEL.leave);
  const saw = async () => {
    await tap('sawhorse, open');
    await tap('Saw timber');
    await tap(LABEL.leave);
  };
  await saw();
  await chop();
  await saw();
  await moves(screen, 'east');
  await tap('plot, open');
  await tap('Raise a timbered hut');
  await tap(LABEL.leave);
  await moves(screen, 'north');
});

walk(
  '2-skill-tree',
  'Craft: skill tree locked, carve twice, learn carving, skill tree again',
  async (r) => {
    const { screen } = r;
    const character = async () => {
      await settle();
      await screen.getByRole('button', /opens Contents/).tap();
      await screen.getByRole('button', /^Character/).tap();
      await settle();
      await screen.getByRole('button', LABEL.backToWorld).tap();
    };
    await r.app.clearState();
    await settle();
    await screen
      .getByRole('button', /^Woodfolk/)
      .first()
      .tap();
    await scene(screen);
    await character();
    for (let i = 0; i < 2; i++) {
      await screen
        .getByRole('button', /^A stick, open$/i)
        .first()
        .tap();
      await screen.getByRole('button', 'Take a stick').tap();
      await settle();
      await screen.getByRole('button', 'bench, open').tap();
      await screen.getByRole('button', 'Carve a spoon').tap();
      await settle();
      await screen.getByRole('button', LABEL.leave).first().tap();
    }
    await screen.getByRole('button', /^The old carver, open$/i).tap();
    await screen.getByRole('button', 'Talk the old carver').tap();
    await screen.getByRole('button', 'Learn carving').tap();
    const leave = () => screen.getByRole('button', /^Leave/).first();
    for (let i = 0; i < 3 && (await settle(), await leave().isVisible()); i++) await leave().tap();
    await character();
  },
);
