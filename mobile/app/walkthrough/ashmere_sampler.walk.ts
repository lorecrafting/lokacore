// The sampler precedent's route (`LOKA_WALK=ashmere_sampler npm run walkthrough`): the toolbox
// foundation proof that the walkthrough plays a compiled sampler (docs/MECHANICS-TOOLBOX.md,
// foundation 4). A mechanic sampler's routes take this file's shape.
import { expect } from 'e2e';
import { moves, talk, walk } from './walk.ts';

walk('1-lantern', "Bram's lantern: take the errand, walk to the inn and its cellar", async (r) => {
  const { screen } = r;
  await r.app.clearState();
  // No ancestry choice in this cartridge: the chapter title page, then the entry room.
  await screen.getByRole('button', 'Continue').tap();
  await expect(screen.getByRole('button', 'Ferry Landing, look')).toBeVisible();
  await talk(screen, 'Old Bram', "Offer to fetch Bram's lantern");
  await moves(screen, 'north', 'east', 'down');
});
