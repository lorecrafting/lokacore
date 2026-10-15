// StatusIcons: the round, graphic-only condition icons above the status line
// (BOOK-UI-COMPONENTS.md, Status icon). Time 720 in every story.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { expect, fireEvent, fn, waitFor } from 'storybook/test';
import { StatusIcons } from '../book/StatusIcon.tsx';

const at = (label: string, kind?: 'buff' | 'debuff', ends_at?: number) =>
  ({ label, kind, ends_at, resource: 'mv', tick_every: 1800 }) as never; // label is a TextKey
const fed = at('condition.fed', 'buff', 3600);
const poisoned = at('poisoned', 'debuff', 960);
const rested = at('rested', undefined, 1320);
const scarred = at('scarred', 'debuff');
const five = [fed, poisoned, rested, scarred, at('warded', 'buff', 810)];

const meta = {
  title: 'Book/StatusIcon',
  component: StatusIcons,
  args: {
    conditions: [fed],
    time: 720,
    text: (key: string) => (key === 'condition.fed' ? 'fed' : key),
    open: fn(),
  },
} satisfies Meta<typeof StatusIcons>;
export default meta;
type Story = StoryObj<typeof meta>;

// A buff: card fill, line border, fg glyph. Tap or Enter opens Character.
export const Buff: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const icon = canvas.getByRole('button', { name: 'fed, 48m remaining, buff, opens Character' });
    await userEvent.click(icon);
    icon.focus();
    await userEvent.keyboard('{Enter}');
    await expect(args.open).toHaveBeenCalledTimes(2);
  },
};

// A debuff: fg fill, bg glyph, danger ring.
export const Debuff: Story = {
  args: { conditions: [poisoned] },
  play: async ({ canvas }) => {
    const name = 'poisoned, 4m remaining, debuff, opens Character';
    await expect(canvas.getByRole('button', { name })).toBeVisible();
  },
};

// No kind: card fill, line border, dim glyph.
export const Neutral: Story = {
  args: { conditions: [rested] },
  play: async ({ canvas }) => {
    const name = 'rested, 10m remaining, opens Character';
    await expect(canvas.getByRole('button', { name })).toBeVisible();
  },
};

// Permanent (no ends_at): no time part in the name or the tip.
export const Permanent: Story = {
  args: { conditions: [scarred] },
  play: async ({ canvas, userEvent }) => {
    const icon = canvas.getByRole('button', { name: 'scarred, debuff, opens Character' });
    await userEvent.hover(icon); // web: a hover shows the tip too
    await waitFor(() => expect(canvas.getByText('scarred')).toBeVisible());
    await userEvent.unhover(icon);
    await waitFor(() => expect(canvas.queryByText('scarred')).toBeNull());
  },
};

// Five conditions: five icons, no +N disc.
export const Five: Story = {
  args: { conditions: five },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('button')).toHaveLength(5);
    await expect(canvas.queryByRole('button', { name: /more/ })).toBeNull();
  },
};

// Six: five icons, then a +1 disc that opens Character too (6x44 + 5x6 = 294 px within 358 at 390).
export const Overflow: Story = {
  args: { conditions: [...five, at('mighty', 'buff', 4000)] },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('button')).toHaveLength(6);
    await expect(canvas.getByRole('button', { name: '+1 more, opens Character' })).toBeVisible();
  },
};

// Held: the tip shows the label and time left, in the Tip's look, and goes on release.
export const Held: Story = {
  play: async ({ canvas, args }) => {
    const icon = canvas.getByRole('button', { name: /^fed/ });
    // RN web's responder takes mouse events (Footer.stories.tsx Held); a hold is ~500 ms.
    fireEvent.mouseDown(icon, { button: 0, buttons: 1 });
    const tip = () => expect(canvas.getByText('fed, 48m remaining')).toBeVisible(); // after its fade
    await waitFor(tip, { timeout: 2000 });
    fireEvent.mouseUp(icon);
    await waitFor(() => expect(canvas.queryByText('fed, 48m remaining')).toBeNull());
    await expect(args.open).not.toHaveBeenCalled();
  },
};

// Locked (scene, combat, chapter page): pictures with names, no buttons.
export const Locked: Story = {
  args: { conditions: [fed, poisoned], open: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button')).toBeNull();
    await expect(canvas.getByRole('img', { name: 'fed, 48m remaining, buff' })).toBeVisible();
  },
};

// Focused (keyboard): the tip shows; it follows the clock and goes with its icon or the lock.
function Live(p: { text: (key: string) => string }) {
  const [time, setTime] = useState(720);
  const [conditions, setConditions] = useState([fed, poisoned]);
  const [locked, setLocked] = useState(false);
  return (
    <>
      <StatusIcons
        conditions={conditions}
        time={time}
        text={p.text}
        open={locked ? undefined : () => {}}
      />
      <button onClick={() => setTime(780)}>later</button>
      <button onClick={() => setConditions([poisoned])}>expire</button>
      <button onClick={() => setLocked(true)}>lock</button>
    </>
  );
}
export const Focused: Story = {
  render: (args) => <Live text={args.text} />,
  play: async ({ canvas }) => {
    const tip = (text: string) => waitFor(() => expect(canvas.getByText(text)).toBeVisible());
    const none = () => waitFor(() => expect(canvas.queryByText(/remaining$/)).toBeNull());
    const press = (name: string) => fireEvent.click(canvas.getByText(name)); // focus stays on the icon
    const focusFed = async () => {
      canvas.getByRole('button', { name: /^fed/ }).focus();
      await tip('fed, 48m remaining');
    };
    await focusFed();
    canvas.getByRole('button', { name: /^fed/ }).blur();
    await none();
    await focusFed();
    press('later');
    await tip('fed, 47m remaining');
    press('expire'); // poisoned takes fed's place; its tip must not appear
    await none();
    canvas.getByRole('button', { name: /^poisoned/ }).focus();
    await tip('poisoned, 3m remaining');
    press('lock');
    await none();
  },
};
