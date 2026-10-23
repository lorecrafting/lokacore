// ContinueButton: a scene or chapter continuation (ContinueButton's doc comment).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn } from 'storybook/test';
import { ContinueButton } from '../book/actions.tsx';

const meta = {
  title: 'Book/ContinueButton',
  component: ContinueButton,
  args: { label: 'Continue', onPress: fn() },
} satisfies Meta<typeof ContinueButton>;
export default meta;
type Story = StoryObj<typeof meta>;

// Breaks: the continue button is not a button named by its label, or a press is dropped.
export const Chapter: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
    await expect(args.onPress.mock.calls).toEqual([[]]); // no press event (Storybook cannot send one)
  },
};

export const Scene: Story = { args: { label: 'Wake' } };
