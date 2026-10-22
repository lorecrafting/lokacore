import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step, newWorld, type Cartridge, type World } from '../src/index.ts';
import type { Command, EntityId, Key } from '../src/contracts.gen.ts';
import { key } from '../src/foundation/compose.ts';
import { hash } from '../src/foundation/canonical.ts';
import { resolved } from '../src/commands/actions.ts';
import { resolve as target } from '../src/commands/target.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { check } from '../src/runtime/invariants.ts';
import { read } from './read.ts';
import { fragment } from './fragment.ts';
import { codex, DESK_NOTE, notices, PLAQUE } from './codex_fixture.ts';

const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as World['context'];
const fresh = () => codex.genesis(notices);
const at = (w: World, k: string) =>
  Object.keys(w.details).find((id) => w.details[id].key === k) as EntityId;
const plaque = at(fresh(), 'plaque');
const desk = at(fresh(), 'desk');
const command = (w: World, payload: object): Command =>
  ({
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    world_context_id: w.context,
    payload: { actor_id: w.character, ...payload },
  }) as Command;
const turn = (w: World, payload: object) => step(w, command(w, payload), 1);
const readAt = (w: World, target_id: string) => turn(w, { type: 'read', target_id });

// Breaks: Read chooses Look prose, draws RNG, emits an event or changes gameplay rows.
test('Read selects authored writing with exact empty consequences at a fixed horizon', () => {
  const initial = fresh();
  let w = { ...initial, state: { ...initial.state, clock: 68350 } };
  for (const [id, key, body, alias] of [
    [plaque, 'readable.plaque', PLAQUE, 'hall plaque'],
    [desk, 'readable.desk', DESK_NOTE, 'desk'],
  ]) {
    assert.deepEqual(target(w, w.character, alias), { kind: 'unique', target_id: id });
    const before = hash(w.state as never);
    const result = readAt(w, id);
    assert.deepEqual(result.decision, {
      kind: 'accepted',
      outcome: 'read',
      delta: { ops: [] },
      events: [],
      effects: [],
      rng: [1, 2, 3, 4],
      narration: [{ key }],
    });
    assert.equal(w.cartridge.text[key], body);
    assert.equal(hash(result.world.state as never), before);
    if (id === plaque) w = turn(w, { type: 'move', direction: 'west' }).world;
  }
});

// Breaks: arbitrary entities/non-readable details become readable or off-room writing leaks.
test('Read refuses wrong targets and remote readable details with distinct codes', () => {
  const w = fresh();
  for (const target_id of [
    w.body,
    w.state.containers[w.body],
    'aaaaaaaa-0000-4000-8000-999999999999',
  ])
    assert.deepEqual(readAt(w, target_id).decision, {
      kind: 'rejected',
      error: { code: 'invalid_target' },
    });
  const { readable: _, ...ordinary } = w.details[plaque];
  assert.deepEqual(
    readAt({ ...w, details: { ...w.details, [plaque]: ordinary } }, plaque).decision,
    { kind: 'rejected', error: { code: 'invalid_target' } },
  );
  const study = turn(w, { type: 'move', direction: 'west' }).world;
  assert.deepEqual(readAt(study, plaque).decision, {
    kind: 'rejected',
    error: { code: 'not_present' },
  });
  assert.deepEqual(readAt(w, desk).decision, { kind: 'rejected', error: { code: 'not_present' } });
});

// Breaks: invocation maps Read to item_id, or view/command agreement ignores the exact detail.
test('a projected Read resolves its exact target and the invariant detects a substituted target', () => {
  const w = fresh(),
    view = gameView(w);
  const action = view.actions.find((a) => a.action_key === 'read')!;
  assert.deepEqual(action, {
    action_key: 'read',
    label: 'actions.read_plaque',
    target: { kind: 'entity', scopes: ['inspectable_details'] },
    input: [],
    target_ids: [plaque],
    available: true,
  });
  const id = identify('read-test', w.character, {
    invocation_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    actor_id: w.character,
    action_key: action.action_key,
    target_ids: action.target_ids,
    input: {},
  });
  assert.equal(id.kind, 'identified');
  if (id.kind !== 'identified') return;
  const cmd = resolve(w, id) as Command;
  assert.deepEqual(cmd.payload, { type: 'read', actor_id: w.character, target_id: plaque });
  const observation = {
    view,
    command: cmd,
    decision: step(w, cmd, 1, 'read' as Key).decision,
    resolves: Object.fromEntries(
      Object.values(resolved(w, w.character)).map((a) => [a.key, a.command]),
    ),
    action_key: 'read',
  };
  assert.equal(check('gameview_agrees_with_admission', observation), true);
  assert.equal(
    check('gameview_agrees_with_admission', {
      ...observation,
      view: {
        ...view,
        actions: view.actions.map((a) => (a === action ? { ...a, target_ids: [desk] } : a)),
      },
    }),
    false,
  );
});

// Breaks: projection bypasses room subtraction or Read bypasses them.
test('composed action restrictions remove Read and raw commands cannot bypass them', () => {
  const w = fresh(),
    here = w.state.containers[w.body];
  const subtracted: World = {
    ...w,
    rooms: {
      ...w.rooms,
      [here]: { ...w.rooms[here], actions: [{ op: 'subtract', actions: ['read' as Key] }] },
    },
  };
  assert.ok(!gameView(subtracted).actions.some((a) => a.action_key === 'read'));
  assert.deepEqual(readAt(subtracted, plaque).decision, {
    kind: 'rejected',
    error: { code: 'unsupported_capability' },
  });
  const { engine: _, ...readAction } = resolved(w, w.character).read;
  const narrowed: World = {
    ...w,
    cartridge: {
      ...w.cartridge,
      actions: {
        read: { ...readAction, accessibility: 'read.a11y', target: { kind: 'none' } },
      },
    },
  };
  assert.ok(!gameView(narrowed).actions.some((a) => a.action_key === 'read'));
  assert.deepEqual(readAt(narrowed, plaque).decision, {
    kind: 'rejected',
    error: { code: 'unsupported_capability' },
  });
});

// Breaks: Read stays offered or admitted while the player is engaged in combat.
test('combat removes Read and a raw Read during a fight is refused', () => {
  const cellar = fragment('protocol/fixtures/containers_cartridge_sampler_hash.json');
  let fighting = cellar.genesis((c) => {
    c.rooms[`${cellar.prefix}:room/lantern_cellar`].details = {
      shelf_note: {
        aliases: ['note'],
        description: 'detail.shelf_note',
        readable: { label: 'actions.read_note', text: 'readable.shelf_note' },
      },
    };
    for (const caps of [c.manifest.requires.capabilities, c.lock.capabilities])
      Object.assign(caps, { inspectable_detail: 1, readable: 1 });
    Object.assign(c.text, {
      'detail.shelf_note': 'A note pinned to a shelf.',
      'actions.read_note': 'Read the note',
      'readable.shelf_note': 'Mind the rats.',
    });
  });
  for (const direction of ['north', 'east', 'down'])
    fighting = turn(fighting, { type: 'move', direction }).world;
  const note = at(fighting, 'shelf_note');
  assert.ok(gameView(fighting).actions.some((a) => a.action_key === 'read'));
  const rat = Object.entries(fighting.entities).find(([, e]) => e.key === 'cellar_rat_1')![0];
  fighting = turn(fighting, { type: 'attack', target_id: rat }).world;
  assert.ok(gameView(fighting).combat);
  assert.ok(!gameView(fighting).actions.some((a) => a.action_key === 'read'));
  assert.deepEqual(readAt(fighting, note).decision, {
    kind: 'rejected',
    error: { code: 'invalid_state' },
  });
});

// Breaks: a running scene permits Read narration beside its Continue-only contract.
test('a running scene suppresses Read even with readable content present', () => {
  const c = structuredClone(read('protocol/fixtures/cartridge_scene_hash.json').value) as Cartridge;
  const w = newWorld(
    { ...c, lock: { ...c.lock, capabilities: { ...c.lock.capabilities, readable: 1 } } },
    context,
    [1, 2, 3, 4],
  );
  const at = Object.keys(w.details)[0];
  const modal: World = {
    ...w,
    details: {
      ...w.details,
      [at]: {
        ...w.details[at],
        readable: { label: 'read.label' as never, text: 'read.body' as never },
      },
    },
    factDefaults: {
      ...w.factDefaults,
      [key({
        cartridge_id: 'scene_sampler',
        cartridge_version: '0.0.1',
        kind: 'fact',
        key: 'scene_bell_rung',
      })]: 1,
    },
  };
  assert.ok(gameView(modal).scene);
  assert.deepEqual(
    gameView(modal).actions.map((a) => a.action_key),
    ['continue'],
  );
  assert.deepEqual(readAt(modal, at).decision, {
    kind: 'rejected',
    error: { code: 'unsupported_capability' },
  });
});

// Breaks: broad authored detail catalogs exceed query/selector safety budgets silently.
test('Read projection fails closed at query and concrete-target budgets', () => {
  const w = fresh();
  for (const [count, room] of [
    [1025, w.state.containers[w.body]],
    [32769, w.details[desk].room],
  ] as const) {
    const details = Object.fromEntries(
      Array.from({ length: count }, (_, n) => [
        `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`,
        { ...w.details[plaque], room },
      ]),
    );
    assert.throws(() => gameView({ ...w, details }), { message: 'budget_exceeded' });
  }
});
