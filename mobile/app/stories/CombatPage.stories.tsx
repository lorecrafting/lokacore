// C row Pages, Combat (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useEffect, useState, type ReactNode } from 'react';
import { expect, waitFor } from 'storybook/test';
import type { GameView } from '../../packages/game-view/session.ts';
import { Blow } from '../book/Blow.tsx';
import { Combat } from '../book/Combat.tsx';
import { useCues } from '../book/cues.ts';
import { newRound, type DetailLine } from '../book/logs.ts';
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
const rounds: DetailLine[] = [];
for (let r = 1; r <= 20; r++) {
  newRound(rounds);
  rounds.push(`The boar bites you (round ${r}).`, `You strike the boar (round ${r}).`);
}
export const Rounds: StoryObj = {
  ...pageStory(CombatOneFoeView, { combatLog: rounds }),
  name: 'Rounds',
  play: async ({ canvas }) => {
    const last = await canvas.findByText('You strike the boar (round 20).');
    await waitFor(() => expect(last.getBoundingClientRect().bottom).toBeLessThan(innerHeight));
    await expect(last.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    const top = (text: string) => canvas.getByText(text).getBoundingClientRect().top;
    const within = top('You strike the boar (round 19).') - top('The boar bites you (round 19).');
    const between = top('The boar bites you (round 20).') - top('You strike the boar (round 19).');
    await expect(between).toBeGreaterThan(within);
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
    const paper = canvasElement.querySelectorAll<HTMLElement>('[aria-hidden="true"]')[1]!;
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
    const layers = () => [...canvasElement.querySelectorAll('[aria-hidden="true"]')];
    const at = (e: Element) => Number(getComputedStyle(e).opacity);
    await waitFor(() => expect(layers().some((e) => at(e) === opacity.fatal)).toBe(true), {
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
    await waitFor(() => expect(Number(getComputedStyle(held).opacity)).toBe(opacity.fatal), {
      timeout: 3000,
    });
  },
};
