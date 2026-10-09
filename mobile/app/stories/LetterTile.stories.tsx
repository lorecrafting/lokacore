// LetterTile: one riddle letter (BOOK-UI-COMPONENTS.md, Letter tile); the bank is Riddle.stories.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn } from 'storybook/test';
import { LetterTile } from '../book/Riddle.tsx';

const meta = {
  title: 'Book/LetterTile',
  component: LetterTile,
  args: { letter: 'N', used: false, label: 'Letter N, tile 2', onPress: fn() },
} satisfies Meta<typeof LetterTile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Free: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Letter N, tile 2' }));
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};

export const Used: Story = {
  args: { used: true },
  play: async ({ canvas, args, userEvent }) => {
    const tile = canvas.getByRole('button', { name: 'Letter N, tile 2' });
    await expect(tile).toHaveAttribute('aria-disabled', 'true');
    await userEvent.setup({ pointerEventsCheck: 0 }).click(tile);
    await expect(args.onPress).not.toHaveBeenCalled();
  },
};
