// Chapter 1 routes for the polish contact sheet (`npm run walkthrough`, walkthrough.config.ts).
// Each route follows an E1 recorder recipe in kernel/ts/test, translated by hand from its action
// keys to the Book's button labels.
import { begin } from '../tests/steps.ts';
import { moves, scene, talk, walk, type Screen, type Walk } from './walk.ts';

// e1_paths.ts ending(child, allegiance) for each of its ENDINGS (copied: that module needs Node
// types this app's tsconfig lacks): search, childReturn (unless lost), bell, epilogue.
const ENDINGS = [
  ['rescued', 'prior'],
  ['rescued', 'fox'],
  ['stays', 'prior'],
  ['stays', 'fox'],
  ['lost', 'prior'],
] as const;
type Child = (typeof ENDINGS)[number][0];

const search = async (screen: Screen) => {
  await talk(screen, 'Elspeth', 'Will you look around the Green for a sign of Wren?');
  await moves(screen, 'north', 'north');
  await screen.getByRole('button', 'A fox drawing is here., open').tap();
  await screen.getByRole('button', 'Take a fox drawing').tap();
  await moves(screen, 'south', 'south');
  await talk(screen, 'Elspeth', 'I found this drawing on the Green.');
  await moves(screen, 'south', 'south');
  await screen.getByRole('button', 'Tracks, open').tap();
  await screen.getByRole('button', 'Study tracks').tap();
  await screen.getByRole('button', 'Leave').tap();
};

const childReturn = async (r: Walk, child: Child) => {
  const { screen } = r;
  await moves(screen, 'south', 'south');
  await talk(screen, 'Vesper', '“Wren, your mother is looking for you.”');
  await screen.getByRole('button', /^Vesper is here\./).tap();
  await screen.getByRole('button', 'Talk to Vesper').last().tap();
  await r.spell('LANTERN');
  await screen.getByRole('button', 'Leave').tap();
  if (child === 'stays')
    await talk(screen, 'Vesper', '“I’ll take your message to Elspeth. Wren can stay.”');
  else await talk(screen, 'Wren', '“Come with me. I’ll take you back to Elspeth.”');
  await moves(screen, 'north', 'north', 'north', 'north');
  await talk(
    screen,
    'Elspeth',
    child === 'stays' ? 'Give Elspeth Vesper’s message.' : 'Bring Wren to his mother.',
  );
};

const bell = async (screen: Screen, child: Child, allegiance: string) => {
  await moves(screen, ...Array(child === 'lost' ? 7 : 5).fill('north'));
  await talk(screen, 'Prior Aldric', '“I’ll ring the bell.”');
  await moves(screen, 'up', 'up');
  await screen.getByRole('button', 'Chapel bell, open').tap();
  await screen
    .getByRole('button', allegiance === 'prior' ? 'Ring bell' : 'Leave the bell silent')
    .tap();
  await scene(screen);
  // The bell's scene ends back on the Chapel bell page.
  await screen.getByRole('button', 'Leave').tap();
  await moves(screen, 'down', 'down', 'south', 'south', 'south');
};

for (const [child, allegiance] of ENDINGS)
  walk(`1-main-${child}-${allegiance}`, `Main route: Wren ${child}, ${allegiance}`, async (r) => {
    const { screen } = r;
    await begin({ app: r.app, screen }, 'Fen-born');
    await search(screen);
    if (child !== 'lost') await childReturn(r, child);
    await bell(screen, child, allegiance);
    // the epilogue at the market cross
    await screen.getByRole('button', 'Begin epilogue').tap();
    await scene(screen);
  });

// e1_optional_quests.ts chandlersDebt: Peg's ledger delivered to Aldric on time.
walk('2-chandlers-debt', "Side quest: the Chandler's debt, on time", async (r) => {
  const { screen } = r;
  await begin({ app: r.app, screen }, 'Road-born');
  await moves(screen, 'north', 'west');
  await talk(
    screen,
    'Peg Harrow',
    'Take the ledger; promise to deliver it by the second day at six.',
  );
  await moves(screen, 'east', 'north', 'north', 'north', 'north');
  await talk(screen, 'Prior Aldric', 'Give Aldric Peg’s ledger before the deadline.');
});

// e1_optional_quests.ts lanternDream('follow_fox'); tests/book.e2e.ts plays the Wake branch.
walk('3-lantern-dream', 'Side quest: a room at the Lantern, follow the fox', async (r) => {
  const { screen } = r;
  await begin({ app: r.app, screen }, 'Road-born');
  await moves(screen, 'north', 'east');
  await screen.getByRole('button', /^Widow Maud is here\./).tap();
  await screen.getByRole('button', 'Rent room — 3p').tap();
  await screen.getByRole('button', 'Leave').tap();
  await moves(screen, 'up');
  await screen.getByRole('button', 'Bed, open').tap();
  await screen.getByRole('button', 'Rest').tap();
  await scene(screen);
  await screen.getByRole('button', 'Follow the fox').tap();
  await scene(screen);
  await screen.getByRole('button', 'Acknowledge').tap();
});

// e1_wisp_herbs.ts wispWard: three wrong anagrams close the sitting, TIDE answers it, Aldric's ward.
walk('4-wisp-ward', 'Side quest: the wisp ward', async (r) => {
  const { screen } = r;
  await begin({ app: r.app, screen }, 'Road-born');
  await moves(screen, 'south', 'south', 'south', 'east');
  await screen.getByRole('button', 'Marsh glow, open').tap(); // opening the glow seeks the wisp
  await screen.getByRole('button', 'Leave').tap();
  await screen.getByRole('button', /^Wisp is here\./).tap();
  await screen.getByRole('button', 'Speak to Wisp Wisp').tap();
  await screen.getByRole('button', 'Accept the riddle').tap();
  await screen.getByRole('button', 'Leave').tap();
  await screen.getByRole('button', /^Wisp is here\./).tap();
  await screen.getByRole('button', 'Ask Wisp again Wisp').tap();
  for (const wrong of ['EDIT', 'DIET', 'TIED']) await r.spell(wrong);
  await screen.getByRole('button', 'Ask Wisp again Wisp').tap();
  await r.spell('TIDE');
  await screen.getByRole('button', 'Leave').tap();
  await moves(screen, 'west', ...Array(8).fill('north'));
  await screen.getByRole('button', /^Prior Aldric is here\./).tap();
  await screen.getByRole('button', 'Ask about ward Prior Aldric').tap();
  await screen.getByRole('button', 'Discuss the ward').tap();
  await screen.getByRole('button', 'Leave').tap();
});
