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
// 07:00 + 14 h at the showcase's 50 logical s per real s: 21:00, night (its solar cut at 20:00).
const night = wait(1_008_000);
const contents = (section?: string): Step[] => [/; opens Contents$/, ...(section ? [section] : [])];
// The Reeve's talk (Low Wardle Green): the letter errand begins.
const reeve = ['the Reeve, open', 'Talk to the Reeve'];
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
  'a sealed letter, open',
  'Take a sealed letter',
  go('north', 'north', 'north', 'east'),
  'Wat, the shepherd, open',
];
// Nell the baker, on the green.
const nell = [go('south'), 'Nell, the baker, open'];
// The Goblin Pit: two goblins, so the fight is a pack.
const goblins = [go('west', 'south'), nth('A goblin, open')];
// A seed sack too heavy to lift, with a turnip seed inside (Farm Yard).
const sack = [go('north', 'west', 'south'), 'a seed sack, open'];
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
    'A loaf, open',
    'Take a loaf',
    ...contents(LABEL.inventory),
    'a loaf, open',
    'Drop a loaf',
    'A loaf, open',
    'Take a loaf',
  ],
  'room-refusal': [...hall, drag],
  'room-at-night': [night, 'Crossroads Inn, look'],
  'npc-choice': [go('south'), ...reeve],
  'npc-shop': [...nell],
  'npc-services': [go('down', 'north', 'north'), 'The smith, open'],
  'npc-closed': [go('north', 'north', 'east'), 'Wat, the shepherd, open'],
  'notice-read': ['The inn signpost, open'],
  'item-plain': ['a waterskin, open'],
  'item-fuel': [go('up'), 'The lantern, open'],
  'item-container': [
    ...sack,
    'A turnip seed, open',
    'Take a turnip seed',
    'a seed sack, open',
    'Put a turnip seed in a seed sack',
  ],
  'item-too-heavy': [...sack],
  'combat-one-foe': [go('west', 'north'), 'The boar, open', 'Attack the boar'],
  'combat-pack': [...goblins, 'Attack a goblin'],
  'combat-bleeding': [
    go('west', 'north'),
    'The boar, open',
    'Attack the boar',
    wait(3000),
    (b) => {
      // The story shows a bleeding condition: fail the route if none reaches the view.
      if (!JSON.stringify(b.p.screen().view).includes('condition.bleeding'))
        throw new Error('not bleeding');
    },
  ],
  'map-two-levels': [go('up'), (b) => b.map()],
  'map-barred': [...hall, (b) => b.map()],
  'map-where': [...hall, (b) => b.map(), 'Ask where Bess, the alewife is'],
  journal: [...errand, ...contents('Journal')],
  'carrying-empty': [...contents(LABEL.inventory)],
  'carrying-held': ['A loaf, open', 'Take a loaf', ...contents(LABEL.inventory)],
  'character-unknown': [...contents('Character')],
  'character-full': [
    go('west'),
    'Aldous, open',
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
  'night-inn': [night],
};
