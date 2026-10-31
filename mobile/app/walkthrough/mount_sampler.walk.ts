// Mounts row 43b at 390 px (`LOKA_WALK=mount_sampler npm run walkthrough`): mount the horse, ride
// north (the horse's page reads saddled), see the fen exit "not now", dismount and walk it on
// foot, then mount again and ride south.
import { moves, settle, walk, type Screen } from './walk.ts';
import { LABEL } from '../book/labels.ts';

const horse = async (screen: Screen, choice: string) => {
  await screen.getByRole('button', /^Horse, open$/i).tap();
  await screen.getByRole('button', /^Talk/).last().tap();
  await screen.getByRole('button', choice).tap();
  await screen.getByRole('button', LABEL.leaveConversation).tap();
  await screen.getByRole('button', LABEL.leave).tap();
};

walk(
  '1-ride',
  'Ride: mount, north, the fen refuses the horse, dismount, walk in, mount, south',
  async (r) => {
    const { screen } = r;
    await r.app.clearState();
    await settle();
    await horse(screen, 'Mount the horse');
    await moves(screen, 'north');
    await settle();
    // Mounted, east to the fen is refused; the Map draws its exit and offers no Go (owner 2026-10-30).
    await screen.getByRole('button', 'Map').tap();
    await settle();
    await screen.getByRole('button', LABEL.backToWorld).tap();
    await horse(screen, 'Dismount');
    await moves(screen, 'east', 'west');
    await settle();
    await horse(screen, 'Mount the horse');
    await moves(screen, 'south');
    await settle();
  },
);
