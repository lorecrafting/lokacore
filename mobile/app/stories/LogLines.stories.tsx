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

export const SystemLine: Story = {
  args: { lines: ['You read the notice.', { text: 'Journal updated.', event: true }] },
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
    lines: [{ kind: 'refused', reason: 'not here', text: "You can't do that: not here." }],
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

// loka-548k: an NPC's dialogue line, worded through lineWords from its speaker binding, so drift
// in the wording breaks this story (book-ui.md Line placement: dialogue is novel prose).
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
