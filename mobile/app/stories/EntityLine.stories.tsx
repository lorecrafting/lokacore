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
    onPress: fn(),
  },
} satisfies Meta<typeof EntityLine>;
export default meta;
type Story = StoryObj<typeof meta>;

// Breaks: the whole line is not one button whose name leads with its shown text (name, rest, note)
// then ", open", or a press is dropped.
export const NpcWithCarriedNote: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const name = 'Bram the ferryman is here. He carries a long pole., open';
    await userEvent.click(canvas.getByRole('button', { name }));
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};

export const Item: Story = {
  args: { name: 'A brass lantern', note: undefined },
};

export const Held: Story = {
  args: {
    name: 'a brass lantern',
    rest: undefined,
    note: undefined,
  },
};

export const Worn: Story = {
  args: { name: 'a wool cloak', rest: undefined, note: undefined },
};

export const Inside: Story = {
  args: {
    name: 'A tallow candle',
    rest: undefined,
    note: undefined,
  },
};

export const NoticeWithRemainingCount: Story = {
  args: { name: 'Ferry passage', rest: ' (3)', note: undefined },
};

export const ContentsRow: Story = {
  args: { name: 'Character', rest: undefined, note: undefined },
};
