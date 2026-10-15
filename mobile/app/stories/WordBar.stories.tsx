// WordBar: the World page's Word block (BOOK-UI-COMPONENTS.md, Chip and Text field).
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
const keyboard = button('say', { action_key: 'say' });
const view = (more: Partial<GameView> = {}) =>
  ({ actions: [], entities: [smith], ...more }) as unknown as GameView;

const meta = {
  title: 'Book/WordBar',
  component: WordBar,
  args: {
    view: view(),
    chips: [
      keyboard,
      said('say', 'ward'),
      said('say', 'help'),
      said('whisper', 'ward', smith.id),
      said('shout', 'help'),
    ],
    pending: false,
    text: (key: string) =>
      ({ 'npc.smith': 'Smith', 'spell.ignis.unlearned': 'Not yet learned.' })[key] ?? key,
    press: fn(),
  },
} satisfies Meta<typeof WordBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rows: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'ward, whisper to Smith' }));
    await expect(args.press).toHaveBeenCalledWith(args.chips[3]);
  },
};

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
          reason: { code: 'invalid_state', message: { key: 'spell.ignis.unlearned' } },
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
    await expect(canvas.getByText('ignis, cast: Not yet learned.')).toBeVisible();
  },
};

export const FieldOpen: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Type a word' }));
    await expect(canvas.getByLabelText('A word')).toHaveFocus();
  },
};

// Breaks: two words sent as one, or refused without the note.
export const BadWordNote: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Type a word' }));
    await userEvent.type(canvas.getByLabelText('A word'), 'two words');
    await userEvent.click(canvas.getByRole('button', { name: 'Say' }));
    await expect(canvas.getByText('One word, letters only.')).toBeVisible();
    await expect(args.press).not.toHaveBeenCalled();
  },
};
