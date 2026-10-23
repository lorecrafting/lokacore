// StatusLine's say icon and field (StatusLine's doc comment; split from StatusLine.stories.tsx for size).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState, type ComponentProps } from 'react';
import { expect, fn } from 'storybook/test';
import type { Pool } from '../book/model.ts';
import { StatusLine } from '../book/Status.tsx';

const pool = (key: string, current: number, maximum: number) =>
  ({ resource: { key }, current, maximum, tone: 'normal', band: 'normal' }) as unknown as Pool;

// The say field's open state lives in BookView; a local one stands in here.
const Saying = (args: ComponentProps<typeof StatusLine>) => {
  const [open, setOpen] = useState(false);
  return <StatusLine {...args} say={args.say && { ...args.say, open, setOpen }} />;
};
const closed = { open: false, setOpen: fn() }; // replaced by Saying's own state

const meta = {
  title: 'Book/StatusSay',
  component: StatusLine,
  args: {
    time: 3,
    resources: [pool('hp', 30, 30), pool('ma', 10, 10), pool('mv', 60, 60)],
    text: (key: string) => key,
    locked: false,
    pending: false,
    open: fn(),
    openCharacter: fn(),
  },
} satisfies Meta<typeof StatusLine>;
export default meta;
type Story = StoryObj<typeof meta>;

// The say icon after the pools, its field open with Say, Shout and Cast (owner picks wordbar1,
// mvl9qy5ut2x2). Breaks: the field not focused, Enter not saying, a button sending another
// button's action, or the field left open after a send.
// A tap elsewhere on the line closes the field unsent and presses nothing beneath (mvl9rtp93gex).
export const SayOpen: Story = {
  render: Saying,
  args: {
    say: {
      ...closed,
      busy: false,
      sends: [
        { label: 'Say', send: fn() },
        { label: 'Shout', send: fn() },
        { label: 'Cast', send: fn() },
      ],
    },
  },
  play: async ({ canvas, args, userEvent }) => {
    const [say, shout] = args.say!.sends.map((s) => s.send);
    await userEvent.click(canvas.getByRole('button', { name: 'Say to the room' }));
    await expect(canvas.getByLabelText('A word')).toHaveFocus();
    await userEvent.type(canvas.getByLabelText('A word'), 'ward{Enter}');
    await expect(say).toHaveBeenCalledWith('ward');
    await expect(canvas.queryByLabelText('A word')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Say to the room' }));
    await userEvent.type(canvas.getByLabelText('A word'), 'help');
    await userEvent.click(canvas.getByRole('button', { name: 'Shout' }));
    await expect(shout).toHaveBeenCalledWith('help');
    await expect(say).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Say to the room' }));
    const pools = canvas.getByRole('button', { name: /^hp 30\/30/ }).getBoundingClientRect();
    const top = document.elementFromPoint(pools.x + pools.width / 2, pools.y + pools.height / 2);
    await userEvent.click(top!); // whatever is on top where the pools are
    await expect(canvas.queryByLabelText('A word')).toBeNull();
    await expect(args.open).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Say to the room' })); // left open
  },
};

// Breaks: two words sent as one, refused without the note, or Escape not closing the field.
export const SayBadWord: Story = {
  render: Saying,
  args: { say: { ...closed, busy: false, sends: [{ label: 'Say', send: fn() }] } },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Say to the room' }));
    await userEvent.type(canvas.getByLabelText('A word'), 'two words');
    await userEvent.click(canvas.getByRole('button', { name: 'Say' }));
    await expect(canvas.getByText('One word, letters only.')).toBeVisible();
    await expect(args.say!.sends[0]!.send).not.toHaveBeenCalled();
    await userEvent.type(canvas.getByLabelText('A word'), '{Escape}'); // the press moved focus to Say
    await expect(canvas.queryByLabelText('A word')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Say to the room' })); // left open
  },
};
