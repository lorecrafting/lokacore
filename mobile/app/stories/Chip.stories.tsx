// Chip: one word of the World page's Word block (BOOK-UI-COMPONENTS.md, Chip).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn } from 'storybook/test';
import { Chip, ReadingSize } from '../book/Chip.tsx';
import { type } from '../book/tokens.ts';

const meta = {
  title: 'Book/Chip',
  component: Chip,
  args: { word: 'ward', label: 'ward, say', onPress: fn() },
} satisfies Meta<typeof Chip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Available: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'ward, say' }));
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};

// The reason is a line under the row (WordBar), not part of the chip.
export const Unavailable: Story = {
  args: { label: 'ward, cast', onPress: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'ward, cast' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
};

export const Pending: Story = {
  args: { pending: true },
  play: async ({ canvas, args, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'ward, say' });
    await expect(button).toHaveAttribute('aria-busy', 'true');
    // RN web gives a disabled Pressable pointer-events: none; click through it to prove no press.
    await userEvent.setup({ pointerEventsCheck: 0 }).click(button);
    await expect(args.onPress).not.toHaveBeenCalled();
  },
};

// A step of the Settings Reading size row: a radio, inverted while chosen.
export const Chosen: Story = {
  args: { word: 'Large', label: 'Large', chosen: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('radio', { name: 'Large' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  },
};

// The Settings Reading size row: three radio steps, one checked; a press chooses.
const choose = fn();
export const ReadingSizeRow: Story = {
  render: () => <ReadingSize step="large" choose={choose} type={type} />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getAllByRole('radio', { checked: true })).toHaveLength(1);
    await userEvent.click(canvas.getByRole('radio', { name: 'Larger' }));
    await expect(choose).toHaveBeenCalledWith('larger');
  },
};
