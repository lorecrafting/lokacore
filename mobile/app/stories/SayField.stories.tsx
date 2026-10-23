// SayField: the one-word field under the status line and on the NPC page (SayField's doc comment).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn } from 'storybook/test';
import { SayField } from '../book/SayField.tsx';

const meta = {
  title: 'Book/SayField',
  component: SayField,
  args: { pending: false, sends: [{ label: 'Whisper', send: fn() }], close: fn() },
} satisfies Meta<typeof SayField>;
export default meta;
type Story = StoryObj<typeof meta>;

// Breaks: the word not sent with the pressed button, or the field left open after a send.
export const Whisper: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('A word'), 'ward');
    await userEvent.click(canvas.getByRole('button', { name: 'Whisper' }));
    await expect(args.sends[0]!.send).toHaveBeenCalledWith('ward');
    await expect(args.close).toHaveBeenCalledTimes(1);
  },
};

// Breaks: a send while an action is pending (the presenter would retry the pending press).
export const Pending: Story = {
  args: { pending: true },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('A word'), 'ward{Enter}');
    await expect(args.sends[0]!.send).not.toHaveBeenCalled();
  },
};
