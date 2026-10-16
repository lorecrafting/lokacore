// StatusIcons: the round, graphic-only condition icons above the status line
// (BOOK-UI-COMPONENTS.md, Status icon). Time 720 in every story.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { expect, fireEvent, fn, waitFor } from 'storybook/test';
import { StatusIcons } from '../book/StatusIcon.tsx';

// A timed status lasts an hour (duration 3600), so its countdown ring shows what is left of it.
const at = (label: string, kind?: 'buff' | 'debuff', ends_at?: number) =>
  ({
    label,
    kind,
    ends_at,
    duration: ends_at === undefined ? undefined : 3600,
    resource: 'mv',
    tick_every: 1800,
  }) as never; // label is a TextKey
const fed = at('condition.fed', 'buff', 3600); // 80 % left: the ring's arc runs 12 round to 10
const poisoned = at('poisoned', 'debuff', 960);
const rested = at('rested', undefined, 1320);
const scarred = at('scarred', 'debuff');
const five = [fed, poisoned, rested, scarred, at('warded', 'buff', 810)];

const meta = {
  title: 'Book/StatusIcon',
  component: StatusIcons,
  args: {
    conditions: [fed],
    time: 720,
    text: (key: string) => (key === 'condition.fed' ? 'fed' : key),
    open: fn(),
  },
} satisfies Meta<typeof StatusIcons>;
export default meta;
type Story = StoryObj<typeof meta>;

// A buff: card fill, line border, fg glyph. Tap or Enter opens Character.
export const Buff: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const icon = canvas.getByRole('button', { name: 'fed, 48m remaining, buff, opens Character' });
    await userEvent.click(icon);
    icon.focus();
    await userEvent.keyboard('{Enter}');
    await expect(args.open).toHaveBeenCalledTimes(2);
  },
};

// A debuff: fg fill, bg glyph, danger ring.
export const Debuff: Story = {
  args: { conditions: [poisoned] },
  play: async ({ canvas }) => {
    const name = 'poisoned, 4m remaining, debuff, opens Character';
    await expect(canvas.getByRole('button', { name })).toBeVisible();
  },
};

// No kind: card fill, line border, dim glyph.
export const Neutral: Story = {
  args: { conditions: [rested] },
  play: async ({ canvas }) => {
    const name = 'rested, 10m remaining, opens Character';
    await expect(canvas.getByRole('button', { name })).toBeVisible();
  },
};

// Permanent (no ends_at): no time part in the name or the tip.
export const Permanent: Story = {
  args: { conditions: [scarred] },
  play: async ({ canvas, userEvent }) => {
    const icon = canvas.getByRole('button', { name: 'scarred, debuff, opens Character' });
    await userEvent.hover(icon); // web: a hover shows the tip too
    await waitFor(() => expect(canvas.getByText('scarred')).toBeVisible());
    await userEvent.unhover(icon);
    await waitFor(() => expect(canvas.queryByText('scarred')).toBeNull());
  },
};

// Five conditions: five icons, no +N disc.
export const Five: Story = {
  args: { conditions: five },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('button')).toHaveLength(5);
    await expect(canvas.queryByRole('button', { name: /more/ })).toBeNull();
  },
};

// Six: five icons, then a +1 disc that opens Character too (6x44 + 5x6 = 294 px within 358 at 390).
export const Overflow: Story = {
  args: { conditions: [...five, at('mighty', 'buff', 4000)] },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('button')).toHaveLength(6);
    await expect(canvas.getByRole('button', { name: '+1 more, opens Character' })).toBeVisible();
  },
};

// Held: the tip shows the label and time left, in the Tip's look, and goes on release.
export const Held: Story = {
  play: async ({ canvas, args }) => {
    const icon = canvas.getByRole('button', { name: /^fed/ });
    // RN web's responder takes mouse events (Footer.stories.tsx Held); a hold is ~500 ms.
    fireEvent.mouseDown(icon, { button: 0, buttons: 1 });
    const tip = () => expect(canvas.getByText('fed, 48m remaining')).toBeVisible(); // after its fade
    await waitFor(tip, { timeout: 2000 });
    fireEvent.mouseUp(icon);
    await waitFor(() => expect(canvas.queryByText('fed, 48m remaining')).toBeNull());
    await expect(args.open).not.toHaveBeenCalled();
  },
};

// Locked (scene, combat, chapter page): pictures with names, no buttons.
export const Locked: Story = {
  args: { conditions: [fed, poisoned], open: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button')).toBeNull();
    await expect(canvas.getByRole('img', { name: 'fed, 48m remaining, buff' })).toBeVisible();
  },
};

// Focused (keyboard): the tip shows; it follows the clock and goes with its icon or the lock.
function Live(p: { text: (key: string) => string }) {
  const [time, setTime] = useState(720);
  const [conditions, setConditions] = useState([fed, poisoned]);
  const [locked, setLocked] = useState(false);
  return (
    <>
      <StatusIcons
        conditions={conditions}
        time={time}
        text={p.text}
        open={locked ? undefined : () => {}}
      />
      <button onClick={() => setTime(780)}>later</button>
      <button onClick={() => setConditions([poisoned])}>expire</button>
      <button onClick={() => setLocked(true)}>lock</button>
      <button onClick={() => setLocked(false)}>unlock</button>
      <button onClick={() => setConditions([fed, poisoned])}>reapply</button>
    </>
  );
}
export const Focused: Story = {
  render: (args) => <Live text={args.text} />,
  play: async ({ canvas, userEvent }) => {
    const tip = (text: string) => waitFor(() => expect(canvas.getByText(text)).toBeVisible());
    const none = () => waitFor(() => expect(canvas.queryByText(/remaining$/)).toBeNull());
    const press = (name: string) => fireEvent.click(canvas.getByText(name)); // focus stays on the icon
    const focusFed = async () => {
      canvas.getByRole('button', { name: /^fed/ }).focus();
      await tip('fed, 48m remaining');
    };
    await focusFed();
    canvas.getByRole('button', { name: /^fed/ }).blur();
    await none();
    await focusFed();
    press('later');
    await tip('fed, 47m remaining');
    press('expire'); // poisoned takes fed's place; its tip must not appear
    await none();
    canvas.getByRole('button', { name: /^poisoned/ }).focus();
    await tip('poisoned, 3m remaining');
    press('lock');
    await none();
    press('unlock'); // poisoned's button is new and unfocused: no tip
    await none();
    press('reapply');
    await userEvent.hover(canvas.getByRole('button', { name: /^fed/ }));
    await tip('fed, 47m remaining');
    press('expire'); // fed unmounts under the pointer; no hover-out fires
    await none();
    press('reapply'); // fed's new icon is not hovered: no tip
    await none();
    const poisonedIcon = () => canvas.getByRole('button', { name: /^poisoned/ });
    await userEvent.hover(canvas.getByRole('button', { name: /^fed/ }));
    poisonedIcon().focus();
    await tip('poisoned, 3m remaining');
    await userEvent.unhover(canvas.getByRole('button', { name: /^fed/ })); // not poisoned's hold
    await tip('poisoned, 3m remaining');
    press('expire'); // poisoned moves to fed's place: a new icon, unfocused
    await none();
  },
};

// The countdown ring (loka-x6t.65): a dim track and the fg arc of what is left, clockwise from 12;
// the arc drains smoothly between updates (reduced motion: steps). Full: the whole hour left.
export const RingFull: Story = { args: { conditions: [at('condition.fed', 'buff', 4320)] } };

// 80 %: 288 degrees, 12 round to about 10 o'clock (Buff's fed).
export const RingEighty: Story = { args: { conditions: [fed] } };

// Near empty: a minute of the hour left, a sliver right of 12.
export const RingNearEmpty: Story = { args: { conditions: [at('condition.fed', 'buff', 780)] } };
export const RingEmpty: Story = { args: { conditions: [at('condition.fed', 'buff', 720)] } };

// Permanent (scarred): no ring.
export const RingPermanent: Story = { args: { conditions: [scarred] } };

// The left half's turn (the arc past 6 o'clock), read from the page: 108 degrees at 288; NaN while
// it is not drawn.
const leftTurn = (root: HTMLElement) => () => {
  const left = [...root.querySelectorAll<HTMLElement>('div')].filter((d) =>
    d.style.transform.includes('rotate'),
  )[1];
  return left?.style.opacity === '1'
    ? Number(/rotate\((-?[\d.]+)deg\)/.exec(left.style.transform)?.[1])
    : NaN;
};
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

// Draining: a view 250 ms after the first (time 720 to 732) drains the arc from 288 to 286.8 degrees
// over those 250 ms; the first view and a refresh (reapplied, more left) jump. Reduced motion steps
// (fixed at load; keyboard.test.ts covers it).
function Drain(p: { from: number; to: number }) {
  const [time, setTime] = useState(p.from);
  const [ends, setEnds] = useState(3600);
  const [, redraw] = useState(0);
  return (
    <>
      <StatusIcons conditions={[at('condition.fed', 'buff', ends)]} time={time} text={(k) => k} />
      <button onClick={() => setTime(p.to)}>tick</button>
      <button onClick={() => setEnds(4332)}>reapply</button>
      <button onClick={() => redraw((n) => n + 1)}>redraw</button>
    </>
  );
}
export const RingDraining: Story = {
  render: () => <Drain from={720} to={732} />,
  play: async ({ canvas, canvasElement }) => {
    const left = leftTurn(canvasElement);
    await waitFor(() => expect(left()).toBe(108)); // first view: no tween
    await wait(250);
    fireEvent.click(canvas.getByText('tick'));
    await waitFor(() => expect(left() < 108 && left() > 106.85).toBe(true)); // under way
    await waitFor(() => expect(left()).toBeCloseTo(106.8, 5), { timeout: 1100 });
    fireEvent.click(canvas.getByText('reapply')); // the whole hour again: 360 at once
    await waitFor(() => expect(left()).toBe(180), { timeout: 150 });
  },
};

// Past 6 o'clock (time 1790 to 1810, 181 to 179 degrees, views 800 ms apart): the left half stays
// while its last degree drains (the first 400 ms), through a re-render that changes no view, then
// goes.
export const RingDrainingPastSix: Story = {
  render: () => <Drain from={1790} to={1810} />,
  play: async ({ canvas, canvasElement }) => {
    const left = leftTurn(canvasElement);
    await waitFor(() => expect(left()).toBeCloseTo(1, 5));
    await wait(800);
    fireEvent.click(canvas.getByText('tick'));
    fireEvent.click(canvas.getByText('redraw'));
    await waitFor(() => expect(left() < 1 && left() > 0).toBe(true)); // still draining, not dropped
    await waitFor(() => expect(left()).toBeNaN(), { timeout: 1100 });
  },
};
