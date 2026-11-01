// LogLines: the event log and detail history (LogLines's doc comment).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, waitFor } from 'storybook/test';
import type { GameView } from '../../packages/game-view/session.ts';
import { useCues } from '../book/cues.ts';
import { ItemPop } from '../book/ItemPop.tsx';
import { GiltLine } from '../book/GiltLine.tsx';
import { LogLines } from '../book/lines.tsx';
import { usePalette, useType } from '../book/palette.ts';
import { size } from '../book/tokens.ts';
import { Control } from '../book/pages.tsx';
import type { DetailLine } from '../book/logs.ts';
import { markDrawn } from '../book/logs.ts';
import { lineWords } from '../book/words.ts';

const meta = {
  title: 'Book/LogLines',
  component: LogLines,
  args: { lines: ['You step onto the jetty. The water is black and still.'] },
} satisfies Meta<typeof LogLines>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Narration: Story = {};

// Only the line entering this redraw dries (book-ui.md, Effects, sound and haptics).
// Breaks: the older line re-dries (it would leave its settled ink), or the new line never settles.
function Growing() {
  // One array grown in place, as a screen's log is: the mark belongs to the array.
  const [lines] = useState<DetailLine[]>(() => {
    const old = ['The water is black and still.'];
    markDrawn(old);
    return old;
  });
  const [, redraw] = useState(0);
  return (
    <>
      <LogLines lines={lines} />
      <Control
        label="Back to World"
        onPress={() => redraw(lines.push('A bell carries over the yard.'))}
      />
    </>
  );
}
export const NewLineDries: Story = {
  render: () => <Growing />,
  play: async ({ canvas, userEvent }) => {
    const color = (text: string) => getComputedStyle(canvas.getByText(text)).color;
    const settled = color('The water is black and still.');
    await userEvent.click(canvas.getByRole('button', { name: 'Back to World' }));
    await expect(color('The water is black and still.')).toBe(settled);
    await waitFor(() => expect(color('A bell carries over the yard.')).toBe(settled));
  },
};

// Every narrated event kind (book-ui.md Line placement, loka-lsqi): one ink italic style, no colon.
// Breaks: an event line draws dim or upright again, or two kinds draw differently.
export const NarratedEvents: Story = {
  args: {
    lines: [
      'Aldous drills you until your arm aches.',
      { text: 'You learn Blade.', event: true },
      { text: 'Your Blade improves.', event: true },
      { text: 'You make a note in your journal.', event: true },
      { text: 'You remember what you heard earlier.', event: true },
      'The bell carries over the yard.',
      { kind: 'refused', reason: 'locked', text: "You can't do that—locked." },
    ],
  },
  play: async ({ canvas }) => {
    const style = (t: string) => getComputedStyle(canvas.getByText(t));
    const event = style('You learn Blade.');
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

// The pop is the log's one transient (book-ui.md, Room page anatomy).
// Breaks: a first view pops, the words are not the view's names, or two items take two lines.
const pack = (...names: string[]) =>
  ({
    place: { id: 'jetty' },
    journal: [],
    inventory: names.map((name) => ({ id: name, name })),
  }) as unknown as GameView;
function Picking() {
  const [view, setView] = useState(() => pack());
  useCues(view, false, 0);
  return (
    <View>
      <LogLines lines={['You take the sack and the rope.']} />
      <ItemPop view={view} text={(key) => key} />
      <View style={{ height: size.touch }} />
      <Control label="Take" onPress={() => setView(pack('sack', 'rope'))} />
    </View>
  );
}
export const ItemPopTwoItems: Story = {
  render: () => <Picking />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.queryByText(/^\+ /)).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Take' }));
    // Hidden from assistive tech, so found by its words rather than its role.
    await expect(await canvas.findByText('+ sack, + rope')).toBeInTheDocument();
  },
};

function Gilded() {
  const c = usePalette();
  return (
    <GiltLine style={{ ...useType().body, color: c.fg }}>You feel a little stronger.</GiltLine>
  );
}
export const Gilt: Story = {
  render: () => <Gilded />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText('You feel a little stronger.')).toBeVisible();
  },
};
