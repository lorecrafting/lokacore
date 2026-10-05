// scene@1 modal subset: invocation/admission, literal fact/line/event answers and no replay.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { encode, hash } from '../src/foundation/canonical.ts';
import type { Command, Key } from '../src/contracts.gen.ts';
import { key } from '../src/foundation/compose.ts';
import { resolved } from '../src/commands/actions.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { check } from '../src/runtime/invariants.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { gameView, holds, INSTALLED, newWorld, step } from '../src/runtime/world.ts';
import { read } from './read.ts';
import { validate } from '../src/foundation/validate.ts';

const equal = (actual: unknown, expected: unknown) =>
  assert.deepEqual(actual === undefined ? undefined : JSON.parse(JSON.stringify(actual)), expected);
const R = 'ashmere_scene@0.0.1';
const ref = (kind: string, key: string) => ({
  cartridge_id: 'ashmere_scene',
  cartridge_version: '0.0.1',
  kind,
  key,
});
const fresh = (edit = (_: any) => {}): World => {
  const kat = read('protocol/fixtures/cartridge_scene_hash.json');
  const c = structuredClone(kat.value);
  edit(c);
  const canonical = encode(c);
  const sha = createHash('sha256').update(canonical).digest('hex');
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha}"}`),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as World['context'],
    [1, 2, 3, 4],
  );
};
let n = 0;
const identifyAction = (w: World, action_key: string, target?: string, input = {}) => {
  const i = identify('scene-test', w.character, {
    invocation_id: `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    actor_id: w.character,
    action_key,
    target_ids: target ? [w.entityIds[`${R}:${target}`]] : [],
    input,
  });
  assert.equal(i.kind, 'identified');
  if (i.kind !== 'identified') throw new Error('unreachable');
  return i;
};
function invoke(w: World, action_key: string, target?: string, input = {}) {
  const bound =
    action_key === 'continue'
      ? { scene: gameView(w).scene!.scene, line: gameView(w).scene!.index }
      : input;
  const c = resolve(w, identifyAction(w, action_key, target, bound)) as Command;
  assert.ok('payload' in c, JSON.stringify(c));
  const s = step(w, c, n, action_key as Key);
  const resolves = Object.fromEntries(
    Object.values(resolved(w, w.character)).map((a) => [a.key, a.command]),
  );
  assert.ok(
    check('gameview_agrees_with_admission', {
      view: gameView(w),
      command: c,
      decision: s.decision,
      resolves,
      action_key,
    }),
  );
  assert.ok(holds('facts_typed', s.world));
  assert.equal(s.decision.kind, 'accepted', JSON.stringify(s.decision));
  return s;
}
const ready = (w = fresh()) => {
  w = invoke(w, 'lantern').world;
  w = invoke(w, 'take', 'item/lantern').world;
  return invoke(w, 'bram', 'npc/bram').world;
};
const choose = (w: World, choice_id = 'carry') =>
  invoke(w, 'choose', undefined, {
    choice_id,
    continuation_id: gameView(w).choice!.continuation_id,
  });
const facts = (w: World) => Object.values(w.state.facts ?? {});
const shown = (i: number, line: string) => ({
  scene: ref('scene', 'bell_rung'),
  index: i,
  count: 3,
  line: `scene.bell_rung.${line}`,
});
const op = (expected: number, value: number, group: number, actor: World['character']) => ({
  op: 'fact.assign',
  writer_group: group,
  fact: ref('fact', 'scene_bell_rung'),
  scope: { kind: 'player', character_id: actor },
  expected,
  value,
});

// Breaks: two fresh-id empty Continue commands skip unseen lines in a story-started scene.
test('every modal Continue requires its shown scene and line', () => {
  let w = choose(ready()).world;
  for (let i = 0; i < 2; i++) {
    const c = {
      id: `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { type: 'continue', actor_id: w.character },
    } as Command;
    assert.deepEqual(validate('Command', c), [
      { path: '/payload/line', code: 'missing_property' },
      { path: '/payload/scene', code: 'missing_property' },
    ]);
    const result = step(w, c, n);
    assert.equal(result.decision.kind, 'rejected');
    assert.equal(result.world, w);
    assert.equal(gameView(result.world).scene?.index, 1);
    w = result.world;
  }
});

// Breaks: declaring scenes allocates a new initial row/id or leaks a scene before its trigger.
test('fresh scenes keep the same state as their scene-free variant', () => {
  const w = fresh();
  const without = fresh((c) => {
    delete c.scenes;
    delete c.reactions;
    delete c.facts[`${R}:fact/scene_bell_rung`];
    delete c.facts[`${R}:fact/bell_heard`];
  });
  assert.equal(hash(w.state as never), hash(without.state as never));
  assert.equal(Object.hasOwn(w.state, 'facts'), false);
  assert.equal(Object.hasOwn(gameView(w), 'scene'), false);
});

// Breaks: missing start, union rather than replacement, time advance or unadvertised modal refusal.
test('story outcome starts line one and refuses every ordinary action at both boundaries', () => {
  const s = choose(ready());
  const w = s.world;
  assert.equal(s.decision.kind, 'accepted');
  if (s.decision.kind !== 'accepted') return;
  equal(
    s.decision.events.slice(-2).map((e) => e.payload),
    [
      {
        type: 'story_point_reached',
        story_point: ref('story_point', 'lantern_resolved'),
        outcome: 'carry',
      },
      { type: 'fact_changed', fact: ref('fact', 'scene_bell_rung'), old: 0, new: 1 },
    ],
  );
  equal(s.decision.delta.ops.at(-1), op(0, 1, 1, w.character));
  equal(gameView(w).scene, shown(1, 'bell'));
  equal(
    gameView(w).actions.map((a) => a.action_key),
    ['continue'],
  );
  assert.ok(
    [...gameView(w).entities, ...gameView(w).inventory].every((e) => e.actions.length === 0),
  );
  assert.ok(
    gameView(w).exits.every((e) => !e.available && e.reason.code === 'unsupported_capability'),
  );
  for (const action of ['look', 'move'])
    equal(resolve(w, identifyAction(w, action)), {
      kind: 'rejected',
      error: { code: 'unsupported_capability' },
    });
  for (const payload of [
    { type: 'move', direction: 'north' },
    { type: 'wait', until: 25200 },
  ]) {
    const c = {
      id: 'aaaaaaaa-0000-4000-8000-999999999999',
      world_context_id: w.context,
      payload: { ...payload, actor_id: w.character },
    } as Command;
    const refused = step(w, c, 0);
    equal(refused.decision, {
      kind: 'rejected',
      error: { code: 'unsupported_capability' },
    });
    assert.equal(refused.world, w);
    assert.equal(refused.world.state.clock, 21600);
    assert.ok(
      check('gameview_agrees_with_admission', {
        view: gameView(w),
        command: c,
        decision: refused.decision,
      }),
    );
  }
});

// Breaks: advancing the last line past n, resetting to zero, stealing the assign's event slot,
// or preventing ordinary reaction composition/ordinary actions after completion.
test('each continue advances one line, ends at minus one and composes its fact reaction', () => {
  let w = choose(ready()).world;
  for (const [before, after, line] of [
    [1, 2, 'fen'],
    [2, 3, 'fox'],
  ] as const) {
    const s = invoke(w, 'continue');
    w = s.world;
    assert.equal(s.decision.kind, 'accepted');
    if (s.decision.kind !== 'accepted') return;
    assert.equal(s.decision.outcome, 'continued');
    equal(s.decision.delta.ops, [op(before, after, 0, w.character)]);
    equal(gameView(w).scene, shown(after, line));
    assert.equal(w.state.clock, 21600);
  }
  const ended = invoke(w, 'continue');
  w = ended.world;
  assert.equal(ended.decision.kind, 'accepted');
  if (ended.decision.kind !== 'accepted') return;
  assert.equal(ended.decision.outcome, 'ended');
  equal(ended.decision.delta.ops, [
    op(3, -1, 0, w.character),
    {
      op: 'fact.assign',
      writer_group: 1,
      fact: ref('fact', 'bell_heard'),
      scope: { kind: 'player', character_id: w.character },
      expected: false,
      value: true,
    },
  ]);
  equal(
    ended.decision.events.map((e) => [e.position, e.payload]),
    [
      [1, { type: 'fact_changed', fact: ref('fact', 'scene_bell_rung'), old: 3, new: -1 }],
      [2, { type: 'scene_ended', scene: ref('scene', 'bell_rung') }],
      [3, { type: 'fact_changed', fact: ref('fact', 'bell_heard'), old: false, new: true }],
    ],
  );
  assert.equal(ended.decision.events[2].causation_id, ended.decision.events[0].id);
  equal(facts(w).sort(), [-1, true, 'player_led'].sort());
  assert.equal(Object.hasOwn(gameView(w), 'scene'), false);
  const closed = step(
    w,
    {
      id: 'aaaaaaaa-0000-4000-8000-999999999999',
      world_context_id: w.context,
      payload: { type: 'continue', actor_id: w.character },
    } as Command,
    0,
  );
  equal(closed.decision, {
    kind: 'rejected',
    error: { code: 'unsupported_capability' },
  });
  const retry = step(
    w,
    {
      id: 'aaaaaaaa-0000-4000-8000-999999999998',
      world_context_id: w.context,
      payload: {
        type: 'choose',
        actor_id: w.character,
        choice_id: 'carry',
        continuation_id: Object.keys(w.state.choices!)[0],
      },
    } as Command,
    0,
  );
  equal(retry.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
  assert.equal(invoke(w, 'move', undefined, { direction: 'north' }).decision.kind, 'accepted');
});

// Breaks: scene start erroneously requires reaction@1, ignores its zero guard, or starts on leave.
test('start needs only scene and never restarts an ended fact or a different outcome', () => {
  const w = choose(
    ready(
      fresh((c) => {
        delete c.reactions;
        delete c.lock.capabilities.reaction;
        delete c.manifest.requires.capabilities.reaction;
      }),
    ),
  ).world;
  equal(gameView(w).scene, shown(1, 'bell'));
  assert.equal(Object.hasOwn(gameView(choose(ready(), 'leave').world), 'scene'), false);
  let ended = ready();
  const scope = { kind: 'player', character_id: ended.character };
  const row = key({ kind: 'fact', fact: ref('fact', 'scene_bell_rung'), scope });
  ended = { ...ended, state: { ...ended.state, facts: { ...ended.state.facts, [row]: -1 } } };
  const s = choose(ended);
  assert.equal(Object.hasOwn(gameView(s.world), 'scene'), false);
  assert.equal(s.world.state.facts![row], -1);
  if (s.decision.kind === 'accepted')
    assert.ok(
      !s.decision.delta.ops.some((x) => x.op === 'fact.assign' && x.fact.key === 'scene_bell_rung'),
    );
});
