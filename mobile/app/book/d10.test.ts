import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bleedingLine, buttonsOf, group, intentOf } from './model.ts';
import { lineText, replyLine } from './words.ts';
import type { GameView, Reply } from '../../packages/game-view/session.ts';
const view = {
  actor_id: 'actor',
  time: 900,
  place: { id: 'landing', title: { key: 'landing' } },
  actions: [],
  exits: [],
  entities: [],
  inventory: [],
  journal: [],
  known_npcs: [{ id: 'ash', name: 'Ash' }],
  map: { rooms: [{ id: 'landing', title: 'Landing', x: 0, y: 0, z: 0 }], links: [] },
} as unknown as GameView;
const reply = (location: object): Reply =>
  ({
    kind: 'saved',
    decision: {
      kind: 'accepted',
      outcome: 'located',
      location,
      delta: { ops: [] },
      events: [],
      effects: [],
      rng: [1, 2, 3, 4],
    },
  }) as Reply;

// Break: Book sends the remembered name instead of the exact selected identity, or calls stale sight current.
test('Where touch sends exact identity and labels here, saved last seen and unknown', () => {
  const button = buttonsOf(
    view,
    (s) => s,
    (s) => s,
  ).find((b) => b.action_key === 'where')!;
  assert.equal(button.label, 'Ask where Ash is');
  assert.deepEqual(intentOf(button), { action_key: 'where', target_ids: ['ash'], input: {} });
  assert.deepEqual(group([button]).on('ash'), [button]);
  assert.deepEqual(
    replyLine(reply({ target_id: 'ash', status: 'here', room_id: 'landing' }), (s) => s, view),
    ['Ash is here.'],
  );
  // loka-ozu: time since, not the raw clock; view.time is 900.
  for (const [at, line] of [
    [100, 'Ash was last seen at Landing, 13m ago.'],
    [780, 'Ash was last seen at Landing, 2m ago.'],
    [781, 'Ash was last seen at Landing, just now.'],
  ] as const)
    assert.deepEqual(
      replyLine(
        reply({ target_id: 'ash', status: 'last_seen', room_id: 'landing', at }),
        (s) => s,
        view,
      ),
      [line],
    );
  assert.deepEqual(
    replyLine(reply({ target_id: 'hidden', status: 'unknown' }), (s) => s, view),
    ['Their whereabouts are unknown.'],
  );
});

// Breaks: a conflict, invalid or unauthorized press logs its raw kind, "(conflict)", instead of
// the owner-approved sentence (book-ui.md, Shared elapsed status).
test('a press that changed nothing logs a plain sentence', () => {
  const line = (kind: string) =>
    replyLine({ kind } as Reply, (s) => s, view)
      .map(lineText)
      .join(' ');
  assert.equal(line('conflict'), 'The book is still catching up; try again.');
  assert.equal(line('invalid'), "That can't be done.");
  assert.equal(line('unauthorized'), "That isn't yours to do.");
});

// Breaks: the bleeding line shows raw seconds (360s) instead of the conditions' durations (loka-ozu).
test('the bleeding line reads its time left and cadence like a condition', () => {
  const bleeding = { label: 'bleeding', ends_at: 1260, hp_loss: 1, tick_every: 180 } as never;
  assert.equal(
    bleedingLine(bleeding, 900, (s) => s),
    'bleeding · 6m remaining · 1 HP each 3m',
  );
});
