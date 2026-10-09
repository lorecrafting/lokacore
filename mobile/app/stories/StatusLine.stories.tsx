// StatusLine: the one centred line under the footer (BOOK-UI-COMPONENTS.md, Status line).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn } from 'storybook/test';
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

export const Calendar: Story = {
  args: {
    calendar: { day: 3, hour: 6, subdivision: 5, solar: 'grain_rain', lunar: 'waxing_crescent' },
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

// Pennies carry a band tone in the data; the line shows them in ink (model.ts toneOf).
export const PenniesNormal: Story = {
  args: { resources: [...rested, pool('pennies', 12, 999, 'danger')] },
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
