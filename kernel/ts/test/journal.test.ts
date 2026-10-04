// Quest journal selection by invocation (c1-journal; mechanics.md quest@1). Expected texts and
// states come from the source cartridge and literal lifecycle rows, not from the view.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Command, Key, QuestState } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { gameView, INSTALLED, newWorld, step } from '../src/runtime/world.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const world = (name = 'journal'): World => {
  const kat = read(`protocol/fixtures/cartridge_${name}_hash.json`);
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], [1, 2, 3, 4]);
};
let n = 0;
const invoke = (w: World, action_key: string, target?: string, input = {}) => {
  const invocation = {
    invocation_id: `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    actor_id: w.character,
    action_key,
    target_ids: target ? [w.entityIds[`ashmere_journal@0.0.1:${target}`]] : [],
    input,
  };
  const id = identify('journal-test', w.character, invocation);
  assert.equal(id.kind, 'identified');
  if (id.kind !== 'identified') throw new Error('unreachable');
  const command = resolve(w, id) as Command;
  const s = step(w, command, n, action_key as Key);
  assert.equal(s.decision.kind, 'accepted', JSON.stringify(s.decision));
  return s.world;
};
const entry = (w: World, key = 'lantern') => gameView(w).journal.find((q) => q.quest.key === key)!;
const shown = (w: World, state: string, journal: string, key = 'lantern') =>
  assert.deepEqual([entry(w, key).state, entry(w, key).journal], [state, journal]);

// Breaks: active text derived only from the stored state, or terminal outcome overrides/fallback
// ignored; possession changes without a persisted objectives_complete transition.
test('Lantern text follows current possession and terminal choice outcome', () => {
  assert.deepEqual(gameView(world()).journal, []);
  for (const [choice, expected] of [
    ['carry', 'quest.lantern.carried'],
    ['leave', 'quest.lantern.done'],
  ]) {
    let w = invoke(world(), 'lantern');
    shown(w, 'active', 'quest.lantern.find');
    w = invoke(w, 'take', 'item/lantern');
    shown(w, 'active', 'quest.lantern.return');
    w = invoke(w, 'drop', 'item/lantern');
    shown(w, 'active', 'quest.lantern.find');
    w = invoke(w, 'take', 'item/lantern');
    w = invoke(w, 'bram', 'npc/bram');
    w = invoke(w, 'choose', undefined, {
      choice_id: choice,
      continuation_id: gameView(w).choice!.continuation_id,
    });
    shown(w, 'resolved', expected);
  }
});

// Breaks: event-earned credit re-evaluated as current possession or objectives_complete mapped
// back to active text, so dropping the oar erases the earned journal stage.
test('oar acquisition keeps the earned text after drop', () => {
  let w = invoke(world(), 'oar');
  shown(w, 'active', 'quest.oar.find', 'oar');
  w = invoke(w, 'take', 'item/oar');
  shown(w, 'objectives_complete', 'quest.oar.found', 'oar');
  w = invoke(w, 'drop', 'item/oar');
  shown(w, 'objectives_complete', 'quest.oar.found', 'oar');
});

// Breaks: outcome lookup only on resolved rows or missing fallback on absent outcomes.
test('terminal rows use outcome overrides, else their stage text', () => {
  const w = invoke(world(), 'lantern');
  const [id, row] = Object.entries(w.state.quests!)[0];
  for (const [state, outcome, text] of [
    ['failed', 'carry', 'quest.lantern.carried'],
    ['failed', undefined, 'quest.lantern.failed'],
    ['abandoned', undefined, 'quest.lantern.abandoned'],
  ] as const) {
    const terminal = {
      ...w,
      state: {
        ...w.state,
        quests: {
          [id]: { ...row, state: state as QuestState, outcome: outcome as Key | undefined },
        },
      },
    };
    shown(terminal, state, text);
  }
});

// Breaks: an absent declaration emits journal: undefined or title, changing the legacy entry
// shape even though JSON serialization would hide undefined.
test('a quest without journal keeps its existing entry shape', () => {
  const w = invoke(world('errand'), 'lantern');
  assert.deepEqual(gameView(w).journal, [
    {
      quest: {
        cartridge_id: 'ashmere_errand',
        cartridge_version: '0.0.1',
        kind: 'quest',
        key: 'lantern',
      },
      state: 'active',
      title: 'quest.lantern.title',
    },
  ]);
});
