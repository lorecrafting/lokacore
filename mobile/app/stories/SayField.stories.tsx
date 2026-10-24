// SayField: the one-word field under the status line (SayField's doc comment).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn } from 'storybook/test';
import { SayField } from '../book/SayField.tsx';

const meta = {
  title: 'Book/SayField',
  component: SayField,
  args: { pending: false, sends: [{ label: 'Say', send: fn() }], close: fn() },
} satisfies Meta<typeof SayField>;
export default meta;
type Story = StoryObj<typeof meta>;

// Breaks: the word not sent with the pressed button, or the field left open after a send.
export const Send: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('A word'), 'ward');
    await userEvent.click(canvas.getByRole('button', { name: 'Say' }));
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

// Breaks: a known-word chip that sends instead of filling the field.
export const KnownWords: Story = {
  args: { words: ['ward', 'help', 'lux'] },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'lux' }));
    await expect(args.sends[0]!.send).not.toHaveBeenCalled();
    await expect(canvas.getByLabelText('A word')).toHaveValue('lux');
  },
};
