// WordBar: the World page's Word block (Chip and WordBar doc comments).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn } from 'storybook/test';
import type { GameView } from '../../packages/game-view/session.ts';
import { WordBar } from '../book/WordBar.tsx';
import { button } from './fixtures.ts';

const smith = { id: 'smith', name: 'npc.smith' };
const said = (key: string, word: string, to?: string) =>
  button(`${word}, ${to ? 'whisper to Smith' : key}`, {
    action_key: key,
    target_ids: to ? [to] : [],
    input: { word },
  });
const keyboard = button(', say', { action_key: 'say' });
const view = (more: Partial<GameView> = {}) =>
  ({ actions: [], entities: [smith], ...more }) as unknown as GameView;

const meta = {
  title: 'Book/WordBar',
  component: WordBar,
  args: {
    view: view(),
    chips: [
      keyboard, // the keyboard's Say: the status line's say field, never a row here
      said('whisper', 'ward', smith.id),
      said('shout', 'help'),
    ],
    pending: false,
    text: (key: string) => ({ 'npc.smith': 'Smith' })[key] ?? key,
    press: fn(),
  },
} satisfies Meta<typeof WordBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rows: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'ward, whisper to Smith' }));
    await expect(args.press).toHaveBeenCalledWith(args.chips[1]);
  },
};

// A learned word refused by its cost (reason code only, as the kernel emits).
// Breaks: a refused spell word dropped, or shown without its reason.
export const CastWithRefusedWord: Story = {
  args: {
    view: view({
      actions: [{ action_key: 'cast', available: true }],
      spell_words: [
        { word: 'lux', available: true },
        {
          word: 'ignis',
          available: false,
          reason: { code: 'insufficient_resource' },
        },
      ],
    } as never),
    chips: [said('cast', 'lux')],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'ignis, cast' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(canvas.getByText('ignis, cast: too exhausted')).toBeVisible();
  },
};
