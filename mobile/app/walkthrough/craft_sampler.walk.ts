// Homestead hs-14 at 390 px (`LOKA_WALK=craft_sampler npm run walkthrough`): the Character page's
// skill tree before and after learning carving (Woodcraft and Handcraft titles).
import { LABEL } from '../book/labels.ts';
import { settle, walk } from './walk.ts';

walk(
  '1-craft',
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
    await character();
    for (let i = 0; i < 2; i++) {
      await screen
        .getByRole('button', /^A stick is here/)
        .first()
        .tap();
      await screen.getByRole('button', 'Take a stick').tap();
      await settle();
      await screen.getByRole('button', 'Carve a spoon').tap();
      await settle();
    }
    await screen.getByRole('button', /^The old carver is here/).tap();
    await screen.getByRole('button', 'Talk the old carver').tap();
    await screen.getByRole('button', 'Learn carving').tap();
    const leave = () => screen.getByRole('button', /^Leave/).first();
    for (let i = 0; i < 3 && (await settle(), await leave().isVisible()); i++) await leave().tap();
    await character();
  },
);
