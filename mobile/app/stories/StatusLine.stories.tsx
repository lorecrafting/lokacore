// StatusLine: the centred status line under the footer (StatusLine's doc comment).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { expect, fn, within } from 'storybook/test';
import { size, space } from '../book/tokens.ts';
import type { Pool } from '../book/model.ts';
import { StatusLine } from '../book/Status.tsx';

const pool = (key: string, current: number, maximum: number, tone = 'normal') =>
  ({ resource: { key }, current, maximum, tone, band: tone }) as unknown as Pool;
const rested = [pool('hp', 30, 30), pool('ma', 10, 10), pool('mv', 60, 60)];

const meta = {
  title: 'Book/StatusLine',
  component: StatusLine,
  args: {
    time: 3,
    resources: rested,
    text: (key: string) => key,
    locked: false,
    pending: false,
    open: fn(),
    openCharacter: fn(),
  },
} satisfies Meta<typeof StatusLine>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Plain: Story = {
  play: async ({ canvas, args, userEvent }) => {
    // Label in name: the shown text leads, then the hp band and where it goes.
    const name = 'hp 30/30 ma 10/10 mv 60/60; hp normal; opens Contents';
    await userEvent.click(canvas.getByRole('button', { name }));
    await expect(args.open.mock.calls).toEqual([[]]); // the component sends no press event
  },
};

// The sky glyph carries the time in words as its label; the day and hour are not shown.
export const Dusk: Story = {
  args: {
    calendar: { day: 3, hour: 18, subdivision: 5, solar: 'dusk', lunar: 'waxing_crescent' },
  },
  play: async ({ canvas }) => {
    const glyph = canvas.getByLabelText('day 3, 18:05, dusk, waxing crescent moon');
    await expect(glyph).toHaveTextContent('☉');
    await expect(canvas.queryByText(/day 3/)).toBeNull();
  },
};

// The day's weather shows as a word after the glyph; season and tide are in its label only.
export const Weather: Story = {
  args: {
    calendar: {
      day: 1,
      hour: 0,
      subdivision: 0,
      solar: 'night',
      lunar: 'full',
      weather: 'rain',
      season: 'autumn',
      tide: 'high',
    },
  },
  play: async ({ canvas }) => {
    const sky = canvas.getByLabelText('day 1, 00:00, night, full moon, rain, autumn, high tide');
    await expect(sky).toHaveTextContent('○ rain');
    await expect(canvas.queryByText(/autumn/)).toBeNull();
  },
};

// Every sky glyph model.ts `sky` draws: the sun by its phase,
// the moon by its phase at night, the earthly branch for a phase the Book does not know.
const skies: [string, string?][] = [
  ['dawn'],
  ['day'],
  ['dusk'],
  ['night', 'new'],
  ['night', 'waxing_crescent'],
  ['night', 'first_quarter'],
  ['night', 'waxing_gibbous'],
  ['night', 'full'],
  ['night', 'waning_gibbous'],
  ['night', 'last_quarter'],
  ['night', 'waning_crescent'],
  ['night'],
  ['grain_rain'],
];
export const Sky: Story = {
  args: { position: 'standing' as never },
  render: (args) => (
    <View>
      {skies.map(([solar, lunar]) => (
        <StatusLine
          key={`${solar}-${lunar}`}
          {...args}
          calendar={{ day: 1, hour: 12, subdivision: 0, solar, lunar } as never}
        />
      ))}
    </View>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('day 1, 12:00, night, full moon')).toHaveTextContent('○');
    await expect(canvas.getByLabelText('day 1, 12:00, night')).toHaveTextContent('☾');
    await expect(canvas.getByLabelText('day 1, 12:00, grain rain')).toHaveTextContent('子'); // time: 3
  },
};

export const WarningHp: Story = {
  args: { resources: [pool('hp', 14, 30, 'warning'), ...rested.slice(1)] },
};

export const DangerHp: Story = {
  args: { resources: [pool('hp', 5, 30, 'danger'), ...rested.slice(1)] },
};

export const Bleeding: Story = {
  args: {
    bleeding: {
      label: 'bleeding',
      ends_at: 40,
      hp_loss: 1,
      tick_every: 5,
      generation: 1,
      next_tick_at: 5,
    } as never,
  },
};

// The status icon row above the line (Book/StatusIcon has each look); a tap opens Character, which
// keeps the tick parts (keyboard.test.ts). Breaks: durations from two minutes stop reading as
// minutes, or a permanent status (row W8) shows a time part.
export const Conditions: Story = {
  args: {
    time: 60,
    conditions: [
      {
        label: 'poisoned',
        kind: 'debuff',
        ends_at: 300,
        duration: 300,
        next_tick_at: 120,
        resource: 'hp',
        per_tick: -1,
        tick_every: 60,
      },
      {
        label: 'blessed',
        kind: 'buff',
        ends_at: 3660,
        duration: 3600,
        next_tick_at: 660,
        resource: 'mv',
        per_tick: 5,
        tick_every: 600,
      },
      {
        label: 'mighty',
        ends_at: 3660,
        duration: 7200,
        next_tick_at: 3660,
        resource: 'mv',
        tick_every: 600,
      },
      { label: 'scarred', resource: 'hp', tick_every: 60 },
    ] as never,
  },
  play: async ({ canvas, args, userEvent }) => {
    const icon = (name: string) => canvas.getByRole('button', { name: `${name}, opens Character` });
    await expect(icon('poisoned, 4m remaining, debuff')).toBeVisible();
    await expect(icon('blessed, 60m remaining, buff')).toBeVisible();
    await expect(icon('mighty, 60m remaining')).toBeVisible();
    await userEvent.click(icon('scarred'));
    await expect(args.openCharacter).toHaveBeenCalledTimes(1);
  },
};

// Pennies stay off the status line (book-ui.md#world-and-status-entry): not shown, not in the name.
export const Pennies: Story = {
  args: { resources: [...rested, pool('pennies', 12, 999, 'danger')] },
  play: async ({ canvas }) => {
    const name = 'hp 30/30 ma 10/10 mv 60/60; hp normal; opens Contents';
    await expect(canvas.getByRole('button', { name })).toBeVisible();
    await expect(canvas.queryByText(/pennies/)).toBeNull();
  },
};

// A cartridge whose only pool is a count: the button says "character".
export const OnlyPennies: Story = {
  args: { resources: [pool('pennies', 12, 999)] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'character; opens Contents' })).toBeVisible();
  },
};

export const Locked: Story = {
  args: { locked: true },
  play: async ({ canvas, args, userEvent }) => {
    const contents = canvas.getByRole('button', { name: /opens Contents/ });
    await expect(contents).toHaveAttribute('aria-disabled', 'true');
    await userEvent.setup({ pointerEventsCheck: 0 }).click(contents);
    await expect(args.open).not.toHaveBeenCalled();
  },
};

export const Pending: Story = { args: { pending: true } };

// The narrowest phone at the Max Reading size with everything on the line: the pools take line
// two, whole, and position and bleeding truncate on line one (loka-x6t.86).
// Breaks: the row loses flexWrap (the pools stay on line one and the rest is cut); position or
// bleeding loses its one line (shrink or numberOfLines gone, so it wraps instead of truncating).
export const Narrow: Story = {
  globals: { viewport: { value: 'galaxyS25', isRotated: false }, reading: 'Max' },
  args: {
    calendar: { day: 3, hour: 23, subdivision: 0, solar: 'night', lunar: 'full' },
    position: 'sleeping' as never,
    openPosition: fn(),
    bleeding: Bleeding.args!.bleeding,
  },
  play: async ({ canvas, canvasElement }) => {
    const stats = canvas.getByRole('button', { name: /opens Contents$/ });
    const position = canvas.getByRole('button', { name: 'sleeping, change position' });
    await expect(stats.getBoundingClientRect().right).toBeLessThanOrEqual(
      canvasElement.getBoundingClientRect().right,
    );
    await expect(position.getBoundingClientRect().height).toBe(size.touch); // one line
    const word = within(position).getByText('sleeping');
    await expect(word.scrollWidth).toBeGreaterThan(word.clientWidth); // cut short by the ellipsis
    // on line two: both boxes bleed, so compare tops (one row: equal; wrapped: about a line lower)
    await expect(stats.getBoundingClientRect().top).toBeGreaterThan(
      position.getBoundingClientRect().top + size.touch / 2,
    );
  },
};

// The status line's text as laid out, one string per line: a text node below the position
// button's box is on line two.
const lines = (root: HTMLElement, position: HTMLElement) => {
  const split = position.getBoundingClientRect().bottom;
  const out: string[][] = [[], []];
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const range = document.createRange();
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (n.textContent) out[r.top + r.height / 2 > split ? 1 : 0]!.push(n.textContent);
  }
  return out.map((l) => l.join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
};
// At 390 px, inside the page's margins: 358 px wide.
const rainy: Story = {
  globals: { viewport: { value: 'iphone13', isRotated: false } },
  decorators: [
    (Story) => (
      <View style={{ paddingHorizontal: space.xl }}>
        <Story />
      </View>
    ),
  ],
  args: {
    calendar: { day: 1, hour: 0, subdivision: 0, solar: 'night', lunar: 'full', weather: 'rain' },
    position: 'standing' as never,
    openPosition: fn(),
    resources: [pool('hp', 10, 10), pool('ma', 5, 5), pool('mv', 100, 100)],
  },
};

// Breaks: the line wraps (or the gap grows) while one line still fits at 390 px.
export const OneLineLarger: Story = {
  ...rainy,
  globals: { ...rainy.globals, reading: 'Larger' },
  play: async ({ canvas, canvasElement }) => {
    const position = canvas.getByRole('button', { name: 'standing, change position' });
    await expect(lines(canvasElement, position)).toEqual([
      '○ rain · standing hp 10/10 ma 5/5 mv 100/100',
    ]);
  },
};

// Breaks: a dot before hp (it would start line two), the pools split, or the break falls elsewhere.
export const WrapsAtMax: Story = {
  ...rainy,
  globals: { ...rainy.globals, reading: 'Max' },
  play: async ({ canvas, canvasElement }) => {
    const position = canvas.getByRole('button', { name: 'standing, change position' });
    await expect(lines(canvasElement, position)).toEqual([
      '○ rain · standing',
      'hp 10/10 ma 5/5 mv 100/100',
    ]);
  },
};

// Breaks: Tap loses its minHeight; a type.small position reaches size.touch by minHeight alone.
export const Position: Story = {
  args: { position: 'standing' as never, openPosition: fn() }, // a Key, shown as is
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'standing, change position' });
    await expect(button.getBoundingClientRect().height).toBe(size.touch);
  },
};

// The say icon after the pools, its field open with Say, Shout and Cast (owner picks wordbar1,
// mvl9qy5ut2x2). Breaks: the field not focused, Enter not saying, a button sending another
// button's action, or the field left open after a send.
export const SayOpen: Story = {
  args: {
    say: {
      room: 'inn',
      busy: false,
      sends: [
        { label: 'Say', send: fn() },
        { label: 'Shout', send: fn() },
        { label: 'Cast', send: fn() },
      ],
    },
  },
  play: async ({ canvas, args, userEvent }) => {
    const [say, shout] = args.say!.sends.map((s) => s.send);
    await userEvent.click(canvas.getByRole('button', { name: 'Say to the room' }));
    await expect(canvas.getByLabelText('A word')).toHaveFocus();
    await userEvent.type(canvas.getByLabelText('A word'), 'ward{Enter}');
    await expect(say).toHaveBeenCalledWith('ward');
    await expect(canvas.queryByLabelText('A word')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Say to the room' }));
    await userEvent.type(canvas.getByLabelText('A word'), 'help');
    await userEvent.click(canvas.getByRole('button', { name: 'Shout' }));
    await expect(shout).toHaveBeenCalledWith('help');
    await expect(say).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Say to the room' })); // left open
  },
};

// Breaks: two words sent as one, refused without the note, or Escape not closing the field.
export const SayBadWord: Story = {
  args: { say: { room: 'inn', busy: false, sends: [{ label: 'Say', send: fn() }] } },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Say to the room' }));
    await userEvent.type(canvas.getByLabelText('A word'), 'two words');
    await userEvent.click(canvas.getByRole('button', { name: 'Say' }));
    await expect(canvas.getByText('One word, letters only.')).toBeVisible();
    await expect(args.say!.sends[0]!.send).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByLabelText('A word')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Say to the room' })); // left open
  },
};
