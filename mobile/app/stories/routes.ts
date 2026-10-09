// The named routes behind the page stories (views) and live stories (checkpoints): taps as a player
// names them (walkthrough/chapter1.walk.ts), replayed by scenarios.ts.
import type { book } from '../book/__tests__/polish-book.test.ts';
import { refused } from '../book/model.ts';

type Step = string | RegExp | ((b: Harness) => void);
export type Harness = ReturnType<typeof book> & { steps: Step[] };

const go =
  (...directions: string[]): Step =>
  (b) => {
    for (const d of directions) (b.map(), b.tap(`Go ${d}`));
  };
const talk = (npc: string, ...choices: string[]): Step[] => [
  `${npc} is here.`,
  ...choices.flatMap((c) => [`Talk to ${npc}`, c]),
  'Leave',
];
// The n-th of several controls that start alike (four hounds).
const nth =
  (shown: string, n = 0): Step =>
  (b) =>
    b.tap(b.labels().filter((l) => l.startsWith(shown))[n]!);

const fen = ['Fen-born', 'Continue'];
const road = ['Road-born', 'Continue'];
const ask = 'Will you look around the Green for a sign of Wren?';
const search: Step[] = [
  ...fen,
  ...talk('Elspeth', ask),
  go('north', 'north'),
  'A fox drawing is here.',
  'Take a fox drawing',
  go('south', 'south'),
  ...talk('Elspeth', 'I found this drawing on the Green.'),
  go('south', 'south'),
  'Tracks, open',
  'Study tracks',
  'Leave',
];

const vesper = [
  ...search,
  go('south', 'south'),
  ...talk('Vesper', '“Wren, your mother is looking for you.”'),
  'Vesper is here.',
  'Talk to Vesper',
];
const wisp = [
  ...road,
  go('south', 'south', 'south', 'east'),
  'Marsh glow, open',
  'Leave',
  'Wisp is here.',
  'Speak to Wisp Wisp',
  'Accept the riddle',
  'Leave',
  'Wisp is here.',
  'Ask Wisp again Wisp',
];
const hounds = [...road, go('south', 'south', 'east')];
const attack = [...hounds, nth('A fen hound is here.'), 'Attack a fen hound'];
// Real time passes: the elapsed clocks advance and the game catches up (a pulse).
const wait =
  (ms: number): Step =>
  (b) => {
    b.clock.wall += ms;
    b.clock.mono += ms;
    (b.game as unknown as { pulse(): unknown }).pulse();
  };
const contents = (section?: string): Step[] => [/; opens Contents$/, ...(section ? [section] : [])];
// The riddle's tiles, one per letter (walkthrough/chapter1.walk.ts spellOn), then Submit.
const spell =
  (word: string): Step =>
  (b) => {
    const tiles = b.labels().filter((l) => /^., tile \d+$/.test(l));
    for (const letter of word) {
      const tile = tiles.find((t) => t.startsWith(`${letter},`))!;
      tiles.splice(tiles.indexOf(tile), 1);
      b.tap(tile);
    }
    b.tap('Submit');
  };
// A scene: Continue until its pages end.
const scene: Step = (b) => {
  while (b.labels().includes('Continue')) b.tap('Continue');
};
const inn = [...road, go('north', 'east')];
const bed = [
  ...inn,
  'Widow Maud is here.',
  'Rent room — 3p',
  'Leave',
  go('up'),
  'Bed, open',
  'Rest',
];
const dream: Step[] = [...bed, scene];
const chapel = [...road, go('north', 'north', 'north', 'north', 'north')];
// Chapel Steps with the chapel door shut from the map: the way north is barred.
const shut = [
  ...road,
  go('north', 'north', 'north', 'north'),
  (b: Harness) => b.map(),
  'Close the chapel door (north)',
];
// A drag toward a closed exit (Footer's own refusal line; the harness does not expand Footer).
const drag: Step = (b) => {
  const footer = b.draw().find((n) => n.type.name === 'Footer').props;
  footer.refused(
    refused(
      footer.exits.find((e: { available: boolean }) => !e.available),
      footer.text,
    ),
  );
};
// Peg's torch and satchel bought, the torch put in the satchel (Contents > Carrying).
const satchel = [
  ...road,
  go('north', 'west'),
  'Peg Harrow is here.',
  'Buy a torch — 2p',
  'Buy a small satchel — 4p',
  'Leave',
  ...contents('Equipment & Inventory'),
  'a torch, open',
];
// The lone crow in the Oak Branches; the deer at the Drowned Oak below it.
const oak = [...road, go('north', 'north', 'south', 'south', 'south', 'south', 'west', 'south')];
const deer = [...oak, 'A deer is here.', 'Attack a deer', wait(3000)];
const bell = [
  ...search,
  go(...Array(7).fill('north')),
  ...talk('Prior Aldric', '“I’ll ring the bell.”'),
  go('up', 'up'),
  'Chapel bell, open',
  'Ring bell',
];

export const routes: Record<string, Step[]> = {
  'room-first': fen,
  'room-npcs-items': [...fen, ...talk('Elspeth', ask), go('north', 'north')],
  'room-notices': inn,
  'room-long-log': search,
  'room-refusal': [...shut, 'Back to World', drag],
  'room-at-night': [...fen, wait(180_000), 'Ferry Landing, look'],
  'npc-choice': [...fen, 'Elspeth is here.', 'Talk to Elspeth'],
  'npc-riddle': vesper,
  'npc-shop': [...road, go('north', 'west'), 'Peg Harrow is here.'],
  'npc-services': [...inn, 'Widow Maud is here.'],
  'npc-refused': [...wisp, spell('EDIT')],
  'npc-closed': [...search, go('north', 'north'), 'Elspeth is here.'],
  'notice-board': [...inn, 'Notice board, open'],
  'notice-read': [...fen, 'Landing notice, open'],
  'item-plain': [...fen, ...talk('Elspeth', ask), go('north', 'north'), 'A fox drawing is here.'],
  'item-fuel': satchel,
  'item-container': [
    ...satchel,
    'Put a torch in a small satchel',
    'Back to container',
    'a small satchel, open',
  ],
  'notice-bed-resume': [...dream, 'Close'],
  'item-too-heavy': [
    ...inn,
    go('up'),
    'A storage chest is here.',
    'Take a storage chest',
    go('up'),
    'An old trunk is here.',
  ],
  'combat-one-foe': [...oak, go('up'), 'A crow is here.', 'Attack a crow'],
  'combat-pack': [...hounds, nth('Old bones')],
  'combat-bleeding': [...attack, wait(3000), wait(3000), wait(3000)],
  'map-two-levels': [...chapel, go('up', 'up'), (b) => b.map()],
  'map-barred': shut,
  'map-where': [...shut, 'Ask where Elspeth is'],
  dream: dream,
  journal: [...search, ...contents('Journal')],
  'carrying-empty': [...fen, ...contents('Equipment & Inventory')],
  'carrying-held': [
    ...fen,
    ...talk('Elspeth', ask),
    go('north', 'north'),
    'A fox drawing is here.',
    'Take a fox drawing',
    ...contents('Equipment & Inventory'),
  ],
  'character-unknown': [...fen, ...contents('Character')],
  // ponytail: one skill (Fen-born swim) and one topic (the Wisp's ward); Sedge's lessons need the night marsh.
  'character-full': [...fen, ...wisp.slice(road.length), spell('TIDE'), ...contents('Character')],
  scene: bell,
  contents: [...fen, ...contents()],
  'chapter-title': ['Fen-born'],
  ancestry: [],
  settings: [...fen, ...contents('Settings')],
};

export const checkpoints: Record<string, Step[]> = {
  'first-room': fen,
  'elspeth-asked': [...fen, 'Elspeth is here.', 'Talk to Elspeth', ask],
  'vesper-riddle': vesper,
  'peg-shop': [...road, go('north', 'west'), 'Peg Harrow is here.'],
  'maud-paid-bed': [...inn, 'Widow Maud is here.', 'Rent room — 3p', 'Leave'],
  'hound-combat': hounds,
  'chapel-map': [...chapel, go('up', 'up')],
  'corpse-contents': deer,
  'night-green': [...fen, wait(180_000)],
};
