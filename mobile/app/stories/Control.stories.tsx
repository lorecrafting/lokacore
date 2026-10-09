// Control: local navigation that is not an offered action (BOOK-UI-COMPONENTS.md, Control).
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

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, args, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Start over' });
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    // RN web gives a disabled Pressable pointer-events: none; click through it to prove no press.
    await userEvent.setup({ pointerEventsCheck: 0 }).click(button);
    await expect(args.onPress).not.toHaveBeenCalled();
  },
};

// The rest of the catalogue's Control labels.
export const Leave: Story = { args: { label: 'Leave' } };
export const BackToBoard: Story = { args: { label: 'Back to board' } };
export const BackToContainer: Story = { args: { label: 'Back to container' } };
export const BackToMap: Story = { args: { label: 'Back to map' } };
export const Close: Story = { args: { label: 'Close' } };
export const ResumeDream: Story = { args: { label: 'Resume dream' } };
export const ContinueConversation: Story = { args: { label: 'Continue conversation' } };
export const GotIt: Story = { args: { label: 'Got it' } };
