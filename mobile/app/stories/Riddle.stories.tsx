// Riddle: the letter bank over one local answer buffer (BOOK-UI-COMPONENTS.md, Letter tile).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn } from 'storybook/test';
import { Riddle } from '../book/Riddle.tsx';
import { button } from './fixtures.ts';

const meta = {
  title: 'Book/Riddle',
  component: Riddle,
  args: { bank: [...'RNAOLTENSWID'], button: button('answer'), press: fn() },
} satisfies Meta<typeof Riddle>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FullBank: Story = {};

export const AnswerInProgress: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'R, tile 1' }));
    await userEvent.click(canvas.getByRole('button', { name: 'N, tile 2' }));
    await expect(canvas.getByText('RN')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Backspace' }));
    await expect(canvas.queryByText('RN')).toBeNull();
    await expect(canvas.getAllByText('R')).toHaveLength(2); // tile 1 and the answer
    await expect(canvas.getByRole('button', { name: 'N, tile 2' })).not.toHaveAttribute(
      'aria-disabled',
    );
  },
};
