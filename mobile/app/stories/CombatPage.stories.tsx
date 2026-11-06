// C row Pages, Combat (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useEffect, useState, type ReactNode } from 'react';
import { expect, waitFor, within } from 'storybook/test';
import type { GameView } from '../../packages/game-view/session.ts';
import { Blow } from '../book/Blow.tsx';
import { Combat } from '../book/Combat.tsx';
import { useCues } from '../book/cues.ts';
import { newRound, type DetailLine } from '../book/logs.ts';
import { LABEL } from '../book/labels.ts';
import { Control } from '../book/pages.tsx';
import { opacity, size } from '../book/tokens.ts';
import { pageStory } from './screen.tsx';
import CombatOneFoeView from './views/combat-one-foe.json';
import CombatPackView from './views/combat-pack.json';
import CombatBleedingView from './views/combat-bleeding.json';

const meta: Meta = { title: 'Pages/Combat', component: Combat, tags: ['!autodocs'] };
export default meta;

export const OneFoe: StoryObj = {
  ...pageStory(CombatOneFoeView),
  name: 'One foe',
};
export const Pack: StoryObj = {
  ...pageStory(CombatPackView),
  name: 'Pack',
};
export const Bleeding: StoryObj = {
  ...pageStory(CombatBleedingView),
  name: 'Bleeding',
};
// A blow a status barred (loka-x6t.30): the Book's default line for the foe and for the player
// (book/words.ts lineWords). No showcase status bars a blow yet, so the lines are set here.
export const SkippedTurn: StoryObj = {
  ...pageStory(CombatOneFoeView, {
    combatLog: ['The boar is too stunned to do anything.', 'You are too stunned to do anything.'],
  }),
  name: 'Skipped turn',
};
// Each round's lines are one block, a block gap between rounds, and the page follows the newest
// (book-ui.md, Live combat response). Fixture lines. Breaks: rounds run together, or the newest
// round sits below the fold under the action cards.
// Six rounds in the showcase's words, Legend order: your swings, your strike, the boar's condition,
// then its blow (loka-kgd.200, .202).
const rounds: DetailLine[] = [];
for (const round of [
  [
    'You quickly attack 3 times and hit once.',
    'You hardly hit the boar.',
    'The boar has a few bruises.',
    'The boar misses you.',
  ],
  [
    'You quickly attack 3 times and hit 2 times.',
    'You hit the boar.',
    'The boar has some cuts.',
    'The boar hits you.',
  ],
  [
    'You quickly attack and hit 3 times.',
    'You hit the boar hard.',
    'The boar has many nasty wounds.',
    'The boar hits you hard.',
  ],
  [
    'You quickly attack 3 times and hit 2 times.',
    'You hit the boar extremely hard.',
    'The boar is bleeding freely.',
    'The boar hits you.',
  ],
  [
    'You quickly attack and hit 3 times.',
    'You assault the boar with an astonishing blow.',
    'The boar is covered in blood.',
    'The boar misses you.',
  ],
  [
    'You quickly attack 3 times and hit once.',
    'You ravage the boar!',
    'The boar is in awful condition.',
    'The boar hits you extremely hard.',
  ],
]) {
  newRound(rounds);
  rounds.push(...round);
}
export const Rounds: StoryObj = {
  ...pageStory(CombatOneFoeView, { combatLog: rounds }),
  name: 'Rounds',
  play: async ({ canvas }) => {
    const last = await canvas.findByText('The boar hits you extremely hard.');
    await waitFor(() => expect(last.getBoundingClientRect().bottom).toBeLessThan(innerHeight));
    await expect(last.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    const top = (text: string) => canvas.getByText(text).getBoundingClientRect().top;
    const within = top('The boar has many nasty wounds.') - top('You hit the boar hard.');
    // round 3's condition to round 4's strike: its blow, the blank line, round 4's swings, the strike
    const between =
      top('You hit the boar extremely hard.') - top('The boar has many nasty wounds.');
    // A round's lines run on at the log's line pitch; one blank line parts rounds (owner 2026-11-04).
    await expect([within, between]).toEqual([26, 104]);
  },
};
// Each live foe draws its Cast a spell on it… list among the cards (loka-x6t.109.5). Breaks: no list,
// or an option that names no foe.
const boar = CombatOneFoeView.view.entities[0]!;
const flamma = {
  action_key: 'flamma',
  command: 'cast',
  label: 'spell.flamma',
  target: { kind: 'entity', scopes: ['room_occupants'] },
  target_ids: [boar.id],
  available: true,
};
export const FoeCast: StoryObj = {
  ...pageStory({
    ...CombatOneFoeView,
    view: { ...CombatOneFoeView.view, entities: [{ ...boar, actions: [...boar.actions, flamma] }] },
  }),
  name: 'Foe with Cast a spell…',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Cast a spell on the boar…' }));
    await expect(canvas.getByRole('button', { name: /^Flamma, cast flamma on/ })).toBeVisible();
  },
};

// The Combat hotbar (book-ui.md, Combat hotbar): word slots under the scroll, day and night by the
// palette toolbar. The showcase has no untargeted scripted action, so the slots are spell words; noctis
// and umbra (no drawing yet) take the neutral mark. Breaks: no strip, a slot with no name, a barred or
// cooling slot exposed as enabled.
const worded = (spell_words: object[]) => ({
  ...CombatOneFoeView,
  view: { ...CombatOneFoeView.view, spell_words },
});
const time = CombatOneFoeView.view.time;
const ready = { word: 'ward', available: true };
const cooling = {
  word: 'noctis',
  available: false,
  reason: { code: 'cooldown' },
  ends_at: time + 60,
  duration: 150,
};
const barred = { word: 'umbra', available: false, reason: { code: 'invalid_state' } };
export const Hotbar: StoryObj = {
  ...pageStory(worded([ready, cooling, barred])),
  name: 'Hotbar',
  play: async ({ canvas }) => {
    const bar = await canvas.findByRole('group', { name: LABEL.hotbar });
    await expect(bar).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'ward, cast' })).toBeEnabled();
    for (const name of [/^noctis, cast, /, /^umbra, cast, /])
      await expect(canvas.getByRole('button', { name })).toHaveAttribute('aria-disabled', 'true');
  },
};
// One filler: two hairline rings hold the empty slots, unfocusable.
export const HotbarFew: StoryObj = {
  ...pageStory(worded([ready])),
  name: 'Hotbar, one filler',
  play: async ({ canvas }) => {
    const bar = await canvas.findByRole('group', { name: LABEL.hotbar });
    await expect(within(bar).getAllByRole('button')).toHaveLength(2);
  },
};
// The opener opens the list of every filler among the cards; a barred slot reads its reason.
export const HotbarOpen: StoryObj = {
  ...pageStory(worded([ready, cooling, barred, { word: 'lux', available: true }])),
  name: 'Hotbar, opener open',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const opener = await canvas.findByRole('button', { name: LABEL.hotbarOpener });
    await userEvent.click(opener);
    await expect(opener).toHaveAttribute('aria-expanded', 'true');
    await expect(await canvas.findByRole('button', { name: 'lux, cast' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /^umbra, cast, / }));
    const said = [...canvasElement.querySelectorAll('[aria-live="polite"]')].map(
      (n) => n.textContent,
    );
    await expect(said).toContain("You can't do that—not now.");
  },
};

// A blow washes the paper below the ink (book-ui.md, Blow wash). Breaks: no wash on a hit point loss.
const struck = (current: number) =>
  ({
    place: { id: 'yard' },
    journal: [],
    inventory: [],
    combat: {},
    resources: [{ resource: { key: 'hp' }, current, maximum: 20 }],
  }) as unknown as GameView;
function Struck() {
  const [view, setView] = useState(() => struck(20));
  useCues(view, false, 0);
  return (
    <div data-testid="frame" style={{ display: 'flex', width: size.column, height: size.column }}>
      <Blow>
        <Control label="Continue" onPress={() => setView(struck(15))} />
      </Blow>
    </div>
  );
}
export const BlowWash: StoryObj = {
  render: () => <Struck />,
  name: 'Blow wash',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const paper = canvasElement.querySelectorAll<HTMLElement>('[aria-hidden="true"]')[2]!;
    await expect(Number(getComputedStyle(paper).opacity)).toBe(0);
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(Number(getComputedStyle(paper).opacity)).toBeGreaterThan(0));
    // The swell is clipped. Breaks: scrollbars on the whole Combat page at the first blow.
    const frame = canvas.getByTestId('frame');
    await waitFor(() => expect(Number(getComputedStyle(paper).opacity)).toBeGreaterThan(0.1));
    await expect(frame.scrollWidth).toBe(frame.clientWidth);
    await expect(frame.scrollHeight).toBe(frame.clientHeight);
  },
};
// A death in a fight holds the red wash (book-ui.md, Falling). Breaks: the wash clears after a fatal blow.
function Fatal() {
  const [view, setView] = useState(() => struck(5));
  const [died, setDied] = useState<string>();
  useCues(view, false, 0, 0, false, undefined, died);
  return (
    <div style={{ display: 'flex', width: size.column, height: size.column }}>
      <Blow>
        <Control
          label="Continue"
          onPress={() => {
            setView(struck(0));
            setDied('fatal');
          }}
        />
      </Blow>
    </div>
  );
}
// The page a fatal blow closes (owner, 2026-11-02, loka-kgd.204): blood-red held, one Let go, no
// foe line, no countdown. The cues fall from a fight to a death beside the page, as Book's own do.
function Falls({ children }: { children: ReactNode }) {
  const [view, setView] = useState(() => struck(5));
  const [died, setDied] = useState<string>();
  useCues(view, false, 0, 0, false, undefined, died);
  useEffect(() => {
    setView(struck(0));
    setDied('fatal');
  }, []);
  return children;
}
const { combat: closed, ...afterView } = CombatOneFoeView.view;
export const Death: StoryObj = {
  ...pageStory(
    { ...CombatOneFoeView, view: afterView },
    { ended: closed as never, died: 'fatal', fell: true },
  ),
  decorators: [(Story) => <Falls>{Story()}</Falls>],
  name: 'Death',
  play: async ({ canvas, canvasElement }) => {
    // the foot fades in (useDry), so wait for it
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Let go' })).toBeVisible(), {
      timeout: 3000,
    });
    await expect(canvas.queryByRole('button', { name: 'Back to World' })).toBeNull();
    await expect(canvas.queryByText(/standing/)).toBeNull(); // no status line once dead (owner 2026-11-04)
    const layers = () => [...canvasElement.querySelectorAll('[aria-hidden="true"]')];
    const at = (e: Element) => Number(getComputedStyle(e).opacity);
    await waitFor(() => expect(layers().some((e) => at(e) === opacity.fatal.day)).toBe(true), {
      timeout: 3000,
    });
  },
};
export const FatalBlowHeld: StoryObj = {
  render: () => <Fatal />,
  name: 'Fatal blow held',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const held = canvasElement.querySelector<HTMLElement>('[aria-hidden="true"]')!;
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
    // Settled at its hold, so axe reads the resting colours (loka-gj82.10).
    await waitFor(() => expect(Number(getComputedStyle(held).opacity)).toBe(opacity.fatal.day), {
      timeout: 3000,
    });
  },
};
