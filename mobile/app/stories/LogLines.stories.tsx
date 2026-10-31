// LogLines: the event log and detail history (LogLines's doc comment).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect } from 'storybook/test';
import { LogLines } from '../book/lines.tsx';
import { lineWords } from '../book/words.ts';

const meta = {
  title: 'Book/LogLines',
  component: LogLines,
  args: { lines: ['You step onto the jetty. The water is black and still.'] },
} satisfies Meta<typeof LogLines>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Narration: Story = {};

// Every narrated event kind (book-ui.md Line placement, loka-lsqi): one ink italic style, no colon.
// Breaks: an event line draws dim or upright again, or two kinds draw differently.
export const NarratedEvents: Story = {
  args: {
    lines: [
      'Aldous drills you until your arm aches.',
      { text: 'You have learned Blade.', event: true },
      { text: 'Your Blade improves.', event: true },
      { text: 'You make a note in your journal.', event: true },
      { text: 'You remember what you heard earlier.', event: true },
      'The bell carries over the yard.',
      { kind: 'refused', reason: 'locked', text: "You can't do that—locked." },
    ],
  },
  play: async ({ canvas }) => {
    const style = (t: string) => getComputedStyle(canvas.getByText(t));
    const event = style('You have learned Blade.');
    await expect(event.fontStyle).toBe('italic');
    await expect(style("You can't do that—locked.").color).toBe(event.color);
    await expect(style('You make a note in your journal.').color).toBe(event.color);
    await expect(style('The bell carries over the yard.').color).toBe(event.color);
  },
};

// Breaks: a boxed reason chip comes back on the line, or the reason leaves its accessible name.
export const RefusedWithTag: Story = {
  name: 'Refused',
  args: { lines: [{ kind: 'refused', reason: 'locked', text: 'The way west is locked.' }] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('The way west is locked.')).toBeVisible();
    await expect(canvas.queryByText('locked')).toBeNull();
    await expect(canvas.getByLabelText('locked, The way west is locked.')).toBeVisible();
  },
};

// A pressed card the kernel rejects (loka-x6t.17): the same refused line as a barred drag.
export const RejectedPress: Story = {
  args: {
    lines: [{ kind: 'refused', reason: 'not here', text: "You can't do that—not here." }],
  },
};

export const ThirtyLines: Story = {
  args: { lines: Array.from({ length: 30 }, (_, i) => `The tide turns (${i + 1}).`) },
};

export const Empty: Story = { args: { lines: [] } };

// G9 (loka-kgd.193): an NPC's emote as the reader sees it, untargeted, to the reader and to another.
export const NpcEmotes: Story = {
  name: 'NPC emotes',
  args: { lines: ['A goblin cowers in fear.', 'Nell bows to you.', 'Nell bows to the goblin.'] },
};

// An NPC's dialogue line, worded by lineWords from its speaker (book-ui.md Line placement).
const NELL = { entities: [{ id: 'nell', kind: 'npc', name: 'npc.nell', actions: [] }] } as never;
const SAY: Record<string, string> = { 'npc.nell': 'Nell', prompt: '"Well, stranger?"' };
const speech = lineWords(
  { key: 'prompt', participants: { actor: 'body', speaker: 'nell' } },
  (k) => SAY[k] ?? k,
  NELL,
);
export const NpcSpeech: Story = {
  name: 'NPC speech',
  args: { lines: [speech] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Nell says to you, "Well, stranger?"')).toBeVisible();
  },
};
