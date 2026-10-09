// Control: local navigation that is not an offered action (BOOK-UI-COMPONENTS.md, Control).
// Only the enabled state exists in pages.tsx; the catalogue's disabled state has no prop yet.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn } from 'storybook/test';
import { Control } from '../book/pages.tsx';

const meta = {
  title: 'Book/Control',
  component: Control,
  args: { label: 'Start over', onPress: fn() },
} satisfies Meta<typeof Control>;
export default meta;
type Story = StoryObj<typeof meta>;

export const StartOver: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Start over' }));
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};

export const BackToWorld: Story = { args: { label: 'Back to World' } };
