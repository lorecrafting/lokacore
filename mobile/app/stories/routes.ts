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
const reeve = ['Reeve, open', 'Talk to the Reeve'];
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
  'sealed letter, open',
  'Take a sealed letter',
  go('north', 'north', 'north', 'east'),
  'Wat, open',
];
// Nell the baker, on the green.
const nell = [go('south'), 'Nell, open'];
// The Goblin Pit: two goblins, so the fight is a pack.
const goblins = [go('west', 'south'), 'Two goblins, open'];
// A seed sack too heavy to lift, with a turnip seed inside (Farm Yard).
const sack = [go('north', 'west', 'south'), 'seed sack, open'];
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
    'loaf, open',
    'Take a loaf',
    ...contents(LABEL.inventory),
    'a loaf, open',
    'Drop a loaf',
    'loaf, open',
    'Take a loaf',
  ],
  'room-refusal': [...hall, drag],
  'room-at-night': [night, 'Crossroads Inn, look'],
  'npc-choice': [go('south'), ...reeve],
  'npc-shop': [...nell],
  'npc-shelf': [...nell, LABEL.trade, 'Cob of bread — 4p'],
  'npc-silent': [go('down', 'west'), 'fence, open'],
  'npc-services': [go('down', 'north', 'north'), 'smith, open'],
  'npc-closed': [go('north', 'north', 'east'), 'Wat, open'],
  'notice-read': ['signpost, open'],
  'item-plain': ['waterskin, open'],
  'item-fuel': [go('up'), 'lantern, open'],
  'item-container': [
    ...sack,
    'Open a seed sack',
    'A turnip seed, open',
    'Take a turnip seed',
    'seed sack, open',
    'Put a turnip seed in a seed sack',
  ],
  // A loaf and the waterskin put into the open sack beside its seed: three things inside.
  'item-inside': [
    'loaf, open',
    'Take a loaf',
    'waterskin, open',
    'Take a waterskin',
    ...sack,
    'Open a seed sack',
    LABEL.close,
    'Put a loaf in a seed sack',
    'Put a waterskin in a seed sack',
    LABEL.lookInside,
  ],
  'item-inside-empty': [
    ...sack,
    'Open a seed sack',
    'A turnip seed, open',
    'Take a turnip seed',
    'seed sack, open',
    LABEL.lookInside,
  ],
  'item-too-heavy': [...sack],
  'combat-one-foe': [go('west', 'north'), 'boar, open', 'Attack the boar'],
  'combat-pack': [...goblins, 'Attack a goblin'],
  'combat-bleeding': [
    go('west', 'north'),
    'boar, open',
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
  'carrying-held': ['loaf, open', 'Take a loaf', ...contents(LABEL.inventory)],
  'character-unknown': [...contents('Character')],
  'character-full': [
    go('west'),
    'Aldous, open',
    'Talk to Aldous',
    'Learn the blade',
    LABEL.leaveConversation,
    LABEL.leave,
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
  'sack-contents': [...sack, 'Open a seed sack'],
  'night-inn': [night],
};
