// The named routes behind the page stories (views) and live stories (checkpoints): taps as a player
// names them, replayed by scenarios.ts.
import type { book } from '../book/__tests__/polish-book.test.ts';
import { refused } from '../book/model.ts';
import { LABEL } from '../book/labels.ts';

type Step = string | RegExp | ((b: Harness) => void);
export type Harness = ReturnType<typeof book> & { steps: Step[] };

const go =
  (...directions: string[]): Step =>
  (b) => {
    for (const d of directions) (b.map(), b.tap(`Go ${d}`));
  };
// The n-th of several controls that start alike (two goblins).
const nth =
  (shown: string, n = 0): Step =>
  (b) =>
    b.tap(b.labels().filter((l) => l.startsWith(shown))[n]!);

// Real time passes: the elapsed clocks advance and the game catches up (a pulse).
const wait =
  (ms: number): Step =>
  (b) => {
    b.clock.wall += ms;
    b.clock.mono += ms;
    (b.game as unknown as { pulse(): unknown }).pulse();
  };
const contents = (section?: string): Step[] => [/; opens Contents$/, ...(section ? [section] : [])];
// The Reeve's talk (Low Wardle Green): the letter errand begins.
const reeve = ['The Reeve is here., open', 'Talk to the Reeve'];
const errand = [
  go('south'),
  ...reeve,
  'Take the letter to Wat',
  LABEL.leaveConversation,
  LABEL.leave,
];
// The letter taken from the green and carried north and east to Wat's hut.
const hut = [
  ...errand,
  'A sealed letter is here., open',
  'Take a sealed letter',
  go('north', 'north', 'north', 'east'),
  'Wat, the shepherd is here., open',
];
// Nell the baker, on the green.
const nell = [go('south'), 'Nell, the baker is here., open'];
// The Goblin Pit: two goblins, so the fight is a pack.
const goblins = [go('west', 'south'), nth('A goblin is here.')];
// A seed sack too heavy to lift, with a turnip seed inside (Farm Yard).
const sack = [go('north', 'west', 'south'), 'A seed sack is here., open'];
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
// The Moot Hall has two closed exits (east and west).
const hall = [go('south', 'south')];

export const routes: Record<string, Step[]> = {
  'room-first': [],
  'room-npcs-items': [go('south')],
  'room-long-log': [
    'A loaf is here., open',
    'Take a loaf',
    ...contents(LABEL.inventory),
    'a loaf, open',
    'Drop a loaf',
    'A loaf is here., open',
    'Take a loaf',
  ],
  'room-refusal': [...hall, drag],
  'room-at-night': [wait(180_000), 'Crossroads Inn, look'],
  'npc-choice': [go('south'), ...reeve],
  'npc-shop': [...nell],
  'npc-services': [go('down', 'north', 'north'), 'The smith is here., open'],
  'npc-closed': [go('north', 'north', 'east'), 'Wat, the shepherd is here., open'],
  'notice-read': ['The inn signpost, open'],
  'item-plain': ['A waterskin is here., open'],
  'item-fuel': [go('up'), 'The lantern is here., open'],
  'item-container': [
    ...sack,
    'A turnip seed, open',
    'Take a turnip seed',
    'A seed sack is here., open',
    'Put a turnip seed in a seed sack',
  ],
  'item-too-heavy': [...sack],
  'combat-one-foe': [go('west', 'north'), 'The boar is here., open', 'Attack the boar'],
  'combat-pack': [...goblins, 'Attack a goblin'],
  'combat-bleeding': [
    go('west', 'north'),
    'The boar is here., open',
    'Attack the boar',
    wait(3000),
  ],
  'map-two-levels': [go('up'), (b) => b.map()],
  'map-barred': [...hall, (b) => b.map()],
  'map-where': [...hall, (b) => b.map(), 'Ask where Bess, the alewife is'],
  journal: [...errand, ...contents('Journal')],
  'carrying-empty': [...contents(LABEL.inventory)],
  'carrying-held': ['A loaf is here., open', 'Take a loaf', ...contents(LABEL.inventory)],
  'character-unknown': [...contents('Character')],
  'character-full': [
    go('west'),
    'Aldous is here., open',
    'Talk to Aldous',
    'Learn the blade',
    ...contents('Character'),
  ],
  scene: [...hut, 'Talk to Wat, the shepherd', 'Give Wat the letter'],
  contents: [...contents()],
  settings: [...contents('Settings')],
};

export const checkpoints: Record<string, Step[]> = {
  green: [go('south')],
  'reeve-asked': [go('south'), ...reeve],
  'nell-shop': [...nell],
  'goblin-combat': [...goblins],
  'loft-map': [go('up'), (b) => b.map()],
  'sack-contents': [...sack],
  'night-inn': [wait(180_000)],
};
