// PickList: a page's Pick a second thing options (PickLists' doc comment; book-ui.md).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn } from 'storybook/test';
import { PickLists } from '../book/actions.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { button } from './fixtures.ts';

// The cart's page in the use sampler: two buckets (one full), an oilcan, a flint.
const thing = (id: string, name: string, more = {}) => ({ id, name, ...more });
const view = {
  entities: [thing('cart', 'cart')],
  inventory: [
    thing('bucket', 'bucket', { state: 'full' }),
    thing('bucket2', 'bucket', { state: 'empty' }),
    thing('oilcan', 'oilcan'),
    thing('flint', 'flint'),
  ],
} as unknown as GameView;
const pair = (key: string, tool: string, reason?: string) =>
  button(key === 'quench' ? 'Quench' : 'Oil', {
    action_key: key,
    target_ids: ['cart', tool],
    pick: reason ? { reason } : {},
  });

const meta = {
  title: 'Book/PickList',
  component: PickLists,
  args: {
    page: 'cart',
    view,
    buttons: [pair('quench', 'bucket'), pair('quench', 'bucket2')],
    text: (k: string) => k,
    press: fn(),
  },
} satisfies Meta<typeof PickLists>;
export default meta;
type Story = StoryObj<typeof meta>;

const open = async (canvas: { getByRole: Function }, userEvent: { click: Function }) =>
  userEvent.click(canvas.getByRole('button', { name: 'Use an item…' }));

// Breaks: the option is drawn open, or loses its collapsed state.
export const Closed: Story = {
  play: async ({ canvas }) => {
    const option = canvas.getByRole('button', { name: 'Use an item…' });
    await expect(option).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.queryByRole('button', { name: /^Bucket/ })).toBeNull();
  },
};

// Same-name rows carry the bucket's state as a quiet note. Breaks: a row press loses its Button.
export const Open: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await open(canvas, userEvent);
    await expect(canvas.getByText('Full')).toBeVisible();
    await userEvent.click(canvas.getAllByRole('button', { name: /^Bucket/ })[0]!);
    await expect(args.press).toHaveBeenCalledWith(args.buttons[0]);
  },
};

// A resting tool is a `label: reason` note, not a row. Breaks: the note presses.
export const UnavailableRow: Story = {
  args: { buttons: [pair('quench', 'bucket'), pair('quench', 'flint', 'resting')] },
  play: async ({ canvas, userEvent }) => {
    await open(canvas, userEvent);
    await expect(canvas.getByText(/resting/)).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /^Flint/ })).toBeNull();
  },
};

// Two recipes on one page: each row names its verb. Breaks: rows show only the tool's name.
export const RecipesMixed: Story = {
  args: { buttons: [pair('quench', 'bucket'), pair('oil', 'oilcan')] },
  play: async ({ canvas, userEvent }) => {
    await open(canvas, userEvent);
    await expect(canvas.getByRole('button', { name: /^Oil with oilcan/ })).toBeVisible();
  },
};

// While a pick is pending the list stays open. Breaks: a pending press closes it.
export const Pending: Story = {
  args: { pending: true },
  play: async ({ canvas, userEvent }) => {
    await open(canvas, userEvent);
    await userEvent.click(canvas.getAllByRole('button', { name: /^Bucket/ })[0]!);
    await expect(canvas.getAllByRole('button', { name: /^Bucket/ })).toHaveLength(2);
  },
};
