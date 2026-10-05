import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  gameView,
  step,
  type Cartridge,
  type World,
} from '../src/index.ts';
import type { Command, EntityId, Key } from '../src/contracts.gen.ts';
import { key } from '../src/foundation/compose.ts';
import { hash } from '../src/foundation/canonical.ts';
import { resolved } from '../src/commands/actions.ts';
import { resolve as target } from '../src/commands/target.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { check } from '../src/runtime/invariants.ts';
import { read } from './read.ts';

const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as World['context'];
const pin = read('protocol/fixtures/missing_child_v003_hash.json');
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok, JSON.stringify(loaded));
const fresh = () => newWorld(loaded.cartridge as Cartridge, context, [1, 2, 3, 4]);
const notice = 'e368b8b9-c4a5-8d0e-82a0-da17e2d59fe2' as EntityId;
const board = '15349791-fa65-81f7-b378-bb8212b808d2' as EntityId;
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
    [
      notice,
      'readable.notice',
      'Keep the landing clear. Tie boats to the mooring post.',
      'landing notice',
    ],
    [board, 'readable.rumor_board', 'Lost a tin whistle? Ask at the Drowned Lantern.', 'board'],
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
    if (id === notice)
      w = turn(turn(w, { type: 'move', direction: 'north' }).world, {
        type: 'move',
        direction: 'east',
      }).world;
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
  const { readable: _, ...ordinary } = w.details[notice];
  assert.deepEqual(
    readAt({ ...w, details: { ...w.details, [notice]: ordinary } }, notice).decision,
    { kind: 'rejected', error: { code: 'invalid_target' } },
  );
  const north = turn(w, { type: 'move', direction: 'north' }).world;
  assert.deepEqual(readAt(north, notice).decision, {
    kind: 'rejected',
    error: { code: 'not_present' },
  });
  assert.deepEqual(readAt(w, board).decision, { kind: 'rejected', error: { code: 'not_present' } });
});

// Breaks: invocation maps Read to item_id, or view/command agreement ignores the exact detail.
test('a projected Read resolves its exact target and the invariant detects a substituted target', () => {
  const w = fresh(),
    view = gameView(w);
  const action = view.actions.find((a) => a.action_key === 'read')!;
  assert.deepEqual(action, {
    action_key: 'read',
    label: 'actions.read_notice',
    target: { kind: 'entity', scopes: ['inspectable_details'] },
    input: [],
    target_ids: [notice],
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
  assert.deepEqual(cmd.payload, { type: 'read', actor_id: w.character, target_id: notice });
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
        actions: view.actions.map((a) => (a === action ? { ...a, target_ids: [board] } : a)),
      },
    }),
    false,
  );
});

// Breaks: projection bypasses room subtraction or Read bypasses combat/scene restrictions.
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
  assert.deepEqual(readAt(subtracted, notice).decision, {
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
  assert.deepEqual(readAt(narrowed, notice).decision, {
    kind: 'rejected',
    error: { code: 'unsupported_capability' },
  });
  let fighting = w;
  for (const direction of ['north', 'east', 'down'])
    fighting = turn(fighting, { type: 'move', direction }).world;
  const rat = Object.entries(fighting.entities).find(([, e]) => e.key === 'cellar_rat_1')![0];
  fighting = turn(fighting, { type: 'attack', target_id: rat }).world;
  assert.ok(gameView(fighting).combat);
  assert.ok(!gameView(fighting).actions.some((a) => a.action_key === 'read'));
  assert.deepEqual(readAt(fighting, notice).decision, {
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
        cartridge_id: 'ashmere_scene',
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
    [32769, '953a909b-3a29-8c5c-9e3f-4105b9a47c4b' as EntityId],
  ] as const) {
    const details = Object.fromEntries(
      Array.from({ length: count }, (_, n) => [
        `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`,
        { ...w.details[notice], room },
      ]),
    );
    assert.throws(() => gameView({ ...w, details }), { message: 'budget_exceeded' });
  }
});
