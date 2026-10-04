// Chapter markers through invocation, with literal answers from ashmere_chapters declarations
// and triggers (mechanics.md Chapters). The story-point key carry differs from choice take_it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hash } from '../src/foundation/canonical.ts';
import { refStage } from '../src/content/cartridge_refs.ts';
import type { CharacterId, Command, Key } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { gameView, INSTALLED, newWorld, step } from '../src/runtime/world.ts';
import { read } from './read.ts';

const world = (name = 'chapters', edit: (c: any) => void = () => {}): World => {
  const kat = read(`protocol/fixtures/cartridge_${name}_hash.json`);
  const c = JSON.parse(kat.canonical);
  edit(c);
  const loaded = loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: c, content_hash: hash(c) })),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  return newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as World['context'],
    [1, 2, 3, 4],
  );
};
let n = 0;
const invoke = (w: World, action_key: string, target?: string, input = {}) => {
  const invocation = {
    invocation_id: `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    actor_id: w.character,
    action_key,
    target_ids: target ? [w.entityIds[`ashmere_chapters@0.0.1:${target}`]] : [],
    input,
  };
  const id = identify('chapters-test', w.character, invocation);
  assert.equal(id.kind, 'identified');
  if (id.kind !== 'identified') throw new Error('unreachable');
  const s = step(w, resolve(w, id) as Command, n, action_key as Key);
  assert.equal(s.decision.kind, 'accepted', JSON.stringify(s.decision));
  return s;
};
const opening = { index: 0, title: 'chapter.landing' };
const ready = (w = world()) => {
  w = invoke(w, 'lantern').world;
  assert.deepEqual(gameView(w).chapter, opening);
  w = invoke(w, 'take', 'item/lantern').world;
  assert.deepEqual(gameView(w).chapter, opening);
  w = invoke(w, 'bram', 'npc/bram').world;
  assert.deepEqual(gameView(w).chapter, opening);
  return w;
};
const choose = (w: World, choice_id: string) =>
  invoke(w, 'choose', undefined, {
    choice_id,
    continuation_id: gameView(w).choice!.continuation_id,
  });

// Breaks: reaching a chapter before quest resolution, comparing to story-point outcome keys,
// taking the first reached index or ignoring the selected outcome.
test('resolved trigger choices select the highest reached chapter', () => {
  assert.deepEqual(gameView(world()).chapter, opening);
  for (const [choice, index, title, outcome] of [
    ['take_it', 2, 'chapter.reeds', 'carry'],
    ['leave_it', 1, 'chapter.dusk', 'leave'],
  ] as const) {
    const s = choose(ready(), choice);
    assert.deepEqual(gameView(s.world).chapter, { index, title });
    assert.deepEqual(
      Object.values(s.world.state.quests!).map((q) => [q.state, q.outcome]),
      [['resolved', choice]],
    );
    assert.equal(s.decision.kind, 'accepted');
    if (s.decision.kind === 'accepted')
      assert.deepEqual(
        s.decision.events
          .filter((e) => e.payload.type === 'story_point_reached')
          .map((e) => e.payload),
        [
          {
            type: 'story_point_reached',
            story_point: {
              cartridge_id: 'ashmere_chapters',
              cartridge_version: '0.0.1',
              kind: 'story_point',
              key: 'lantern_resolved',
            },
            outcome,
          },
        ],
      );
  }
});

// Breaks: a marker without an outcome only counts an undefined key or one outcome.
test('a story-point marker counts either outcome', () => {
  for (const choice of ['take_it', 'leave_it']) {
    const s = choose(ready(world('chapters', (c) => c.chapters.pop())), choice);
    assert.deepEqual(gameView(s.world).chapter, { index: 1, title: 'chapter.dusk' });
  }
});

// Breaks: matching the story-point key directly, matching a failed/objectives_complete row,
// or scanning another player's quest rather than questOf(player).
test('only the player resolved quest with its trigger choice counts', () => {
  const w = invoke(world(), 'lantern').world;
  const [id, row] = Object.entries(w.state.quests!)[0];
  for (const [state, outcome, character] of [
    ['resolved', 'carry', w.character],
    ['failed', 'take_it', w.character],
    ['objectives_complete', 'take_it', w.character],
    ['resolved', 'take_it', '11111111-2222-4333-8444-555555555555'],
  ] as const) {
    const crafted = {
      ...w,
      state: {
        ...w.state,
        quests: {
          [id]: {
            ...row,
            state,
            outcome: outcome as Key,
            scope: { kind: 'player', character_id: character as CharacterId },
          },
        },
      },
    } as World;
    assert.deepEqual(gameView(crafted).chapter, opening);
  }
});

// Breaks: inserting a chapter property even for legacy cartridges without a declaration.
test('a cartridge without chapters preserves the view shape', () => {
  assert.equal(Object.hasOwn(gameView(world('ferry')), 'chapter'), false);
});

// Breaks: ambiguity only checks the first marker, or rejects unrelated choices/other quests
// and outcomes excluded by a selected chapter marker.
test('ambiguity counts only matching quest choices in selected outcomes', () => {
  const kat = read('protocol/fixtures/cartridge_chapters_hash.json');
  const base = JSON.parse(kat.canonical);
  const prefix = 'ashmere_chapters@0.0.1';
  const add = (c: any, choice: string, quest = 'lantern') => {
    const bram = c.dialogues[`${prefix}:dialogue/bram`];
    c.dialogues[`${prefix}:dialogue/bram_again`] = {
      ...bram,
      key: 'bram_again',
      quest: { ...bram.quest, key: quest },
      choices: { [choice]: bram.choices.take_it },
    };
  };
  add(base, 'take_it');
  assert.deepEqual(
    refStage(base).map((d) => [d.code, d.path, d.data]),
    [
      ['OUTCOME_MISMATCH', '.cartridge.chapters[1].story_point', {}],
      ['OUTCOME_MISMATCH', '.cartridge.chapters[2].story_point', {}],
    ],
  );
  world('chapters', (c) => {
    c.chapters.splice(1, 1);
    add(c, 'leave_it');
  });
  world('chapters', (c) => add(c, 'unrelated_choice'));
  world('chapters', (c) => {
    const q = c.quests[`${prefix}:quest/lantern`];
    c.quests[`${prefix}:quest/other`] = { ...q, key: 'other' };
    add(c, 'take_it', 'other');
  });
});
