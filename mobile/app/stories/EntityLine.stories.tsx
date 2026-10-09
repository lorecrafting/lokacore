// EntityLine: a row that opens a detail (BOOK-UI-COMPONENTS.md, Entity line).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn } from 'storybook/test';
import { EntityLine } from '../book/lines.tsx';

const meta = {
  title: 'Book/EntityLine',
  component: EntityLine,
  args: {
    name: 'Bram the ferryman',
    rest: ' is here.',
    note: 'He carries a long pole.',
    label: 'Bram the ferryman, He carries a long pole., open',
    onPress: fn(),
  },
} satisfies Meta<typeof EntityLine>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NpcWithCarriedNote: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: args.label }));
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};

export const Item: Story = {
  args: { name: 'A brass lantern', note: undefined, label: 'a brass lantern, open' },
};

export const Held: Story = {
  args: {
    name: 'a brass lantern',
    rest: undefined,
    note: undefined,
    label: 'a brass lantern, open',
  },
};

export const Worn: Story = {
  args: { name: 'a wool cloak', rest: undefined, note: undefined, label: 'a wool cloak, open' },
};

export const Inside: Story = {
  args: {
    name: 'A tallow candle',
    rest: undefined,
    note: undefined,
    label: 'a tallow candle, open',
  },
};

export const NoticeWithRemainingCount: Story = {
  args: { name: 'Ferry passage', rest: ' (3)', note: undefined, label: 'Ferry passage' },
};

export const ContentsRow: Story = {
  args: { name: 'Character', rest: undefined, note: undefined, label: 'Character' },
};
