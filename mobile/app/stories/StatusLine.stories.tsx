// StatusLine: the one centred line under the footer (BOOK-UI-COMPONENTS.md, Status line).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { expect, fn } from 'storybook/test';
import { size } from '../book/tokens.ts';
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
  },
} satisfies Meta<typeof StatusLine>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Plain: Story = {
  play: async ({ canvas, args, userEvent }) => {
    // Label in name: the shown text leads, then the hp band and where it goes.
    const name = 'hp 30/30 ma 10/10 mv 60/60; hp normal; opens Contents';
    await userEvent.click(canvas.getByRole('button', { name }));
    await expect(args.open).toHaveBeenCalledTimes(1);
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

// Every sky glyph the catalogue names (BOOK-UI-COMPONENTS.md, Status line): the sun by its phase,
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

// Breaks: durations from two minutes stop reading as minutes, or a gain loses its sign.
export const Conditions: Story = {
  args: {
    time: 60,
    conditions: [
      {
        label: 'poisoned',
        ends_at: 300,
        next_tick_at: 120,
        resource: 'hp',
        per_tick: -1,
        tick_every: 60,
      },
      {
        label: 'blessed',
        ends_at: 3660,
        next_tick_at: 660,
        resource: 'mv',
        per_tick: 5,
        tick_every: 600,
      },
    ] as never,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('poisoned · 4m remaining · -1 HP each 60s')).toBeVisible();
    await expect(canvas.getByLabelText('blessed, 60m remaining, +5 MV each 10m')).toBeVisible();
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

// The narrowest phone with everything on the line: one line, the pools whole, the rest cut.
export const Narrow: Story = {
  globals: { viewport: { value: 'galaxyS25', isRotated: false } },
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
