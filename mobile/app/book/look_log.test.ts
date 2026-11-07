// The room's Look starts the World log over (book-ui.md, room log clearing; owner 2026-11-06).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Game, Reply } from '../../packages/game-view/session.ts';
import { presenter } from './presenter.ts';

const VIEW = {
  actions: [],
  entities: [],
  exits: [],
  inventory: [],
  journal: [],
  place: { id: 'p', title: { key: 'place.title' } },
  time: 0,
} as never;
const projection = { view: VIEW, token: 'view:r:0' };

// Breaks: the room's Look keeps the old log, or empties it but the live region skips Look's own
// lines (it slices from the old length); or an aimed Look (examine) also empties the log.
test("the room's Look starts the log over and is read in full; an aimed Look keeps it", () => {
  let n = 0; // presses answered
  const reply = (outcome: string, narration?: { key: string }[]): Reply =>
    ({
      kind: 'saved',
      command_id: `c${outcome}`,
      decision: { kind: 'accepted', events: [], outcome, narration },
    }) as Reply;
  const replies = [
    reply('waited'),
    reply('waited'),
    reply('looked', [{ key: 'look.line' }]),
    reply('examined'),
  ];
  const g: Game = {
    view: () => projection,
    invoke: () => (n++, replies.shift()!),
    pending: () => false,
    pendingInvocation: () => undefined,
    subscribe: (listener) => {
      listener({ kind: 'state', projection, status: { kind: 'ready' } });
      return () => {};
    },
    text: (key: string) => (key === 'look.line' ? 'A quiet glade.' : undefined),
    lastNarration: () =>
      n > 2 ? { command_id: 'clooked', lines: [{ key: 'look.line' }] } : undefined,
  };
  const p = presenter(g);
  const wait = { label: 'Wait', action_key: 'wait', target_ids: [], input: {} };
  p.press(wait);
  p.press(wait);
  assert.deepEqual(p.screen().log, ['Time passes.', 'Time passes.']);
  p.press({ label: 'Look', action_key: 'look', target_ids: [], input: {} });
  const shown = p.screen();
  assert.deepEqual([shown.log, shown.said.text], [['A quiet glade.'], 'A quiet glade.']);
  p.press({ label: 'Look at a rock', action_key: 'look', target_ids: ['rock'], input: {} });
  assert.equal(p.screen().log[0], 'A quiet glade.');
});
