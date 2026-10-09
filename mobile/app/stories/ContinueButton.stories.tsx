// ContinueButton: a scene or chapter continuation (BOOK-UI-COMPONENTS.md, Continue button).
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

export const Chapter: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};

export const Scene: Story = { args: { label: 'Wake' } };
