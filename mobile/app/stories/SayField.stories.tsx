// SayField: the one-word field, kept for the Realm's room speech (SayField's doc comment).
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

// Breaks: two words sent as one, refused without the note, or Escape not closing the field.
export const BadWord: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('A word'), 'two words');
    await userEvent.click(canvas.getByRole('button', { name: 'Say' }));
    await expect(canvas.getByText('One word, letters only.')).toBeVisible();
    await expect(args.sends[0]!.send).not.toHaveBeenCalled();
    await userEvent.type(canvas.getByLabelText('A word'), '{Escape}'); // the press moved focus to Say
    await expect(args.close).toHaveBeenCalledTimes(1);
  },
};
