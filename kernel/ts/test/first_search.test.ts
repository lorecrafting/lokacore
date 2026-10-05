import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step, type World } from '../src/index.ts';
import type { Command, DefinitionRef, DomainEvent } from '../src/contracts.gen.ts';
import { encode } from '../src/foundation/canonical.ts';
import { validate } from '../src/foundation/validate.ts';
import { accepted, allocator } from '../src/runtime/decision.ts';
import { admit, adopt } from '../src/runtime/proposal.ts';
import { sequence, triggered } from '../src/mechanics/reaction.ts';
import { gameview_agrees_with_admission } from '../src/view/invariants_view.ts';
import { read } from './read.ts';

const pin = read('protocol/fixtures/missing_child_v009_hash.json');
const prefix = 'ashmere_missing_child@0.0.9:';
const ref = (kind: string, key: string) =>
  ({
    cartridge_id: 'ashmere_missing_child',
    cartridge_version: '0.0.9',
    kind,
    key,
  }) as DefinitionRef;
const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const actor = 'bd595711-ea5f-89a5-abb0-046cd349d2f9';
const other = 'aaaaaaaa-0000-4000-8000-000000000099';
const instance = 'aaaaaaaa-0000-4000-8000-000000000020';
const tracks = '86b28f4e-f743-87f8-8375-2ead5c2c295c';
const load = (change: (c: any) => void = () => {}) => {
  const c = structuredClone(pin.value);
  change(c);
  const content_hash = createHash('sha256').update(encode(c)).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: c, content_hash })),
    INSTALLED,
  );
};
const fresh = () => {
  const c = load();
  assert.ok(c.ok && c.cartridge.format === 'loka-cartridge-v2');
  return newWorld(c.cartridge, context as never, [1, 2, 3, 4]);
};
const resolved = (): World => {
  const w = fresh();
  return {
    ...w,
    state: {
      ...w.state,
      quests: {
        [instance]: {
          quest: ref('quest', 'first_lead'),
          scope: { kind: 'player', character_id: actor as never },
          state: 'resolved',
          outcome: 'report' as never,
        },
      },
    },
  };
};
const cause = (): DomainEvent =>
  ({
    id: 'aaaaaaaa-0000-4000-8000-000000000021',
    world_context_id: context,
    scope: { kind: 'player', character_id: actor },
    actor_id: actor,
    logical_time: 64800,
    position: 1,
    causation_id: 'aaaaaaaa-0000-4000-8000-000000000022',
    correlation_id: 'aaaaaaaa-0000-4000-8000-000000000022',
    payload: {
      type: 'quest_resolved',
      quest: ref('quest', 'first_lead'),
      instance_id: instance,
      outcome: 'report',
    },
  }) as DomainEvent;
const deliver = (w: World, e = cause()) =>
  sequence(
    w,
    other as never,
    w.cartridge.reactions![prefix + 'reaction/start_search'],
    e,
    1,
    { n: 0 },
    allocator(w, { id: e.causation_id as never }),
  );

// Breaks: source actor is replaced by the root actor, quest events lose ownership/causation,
// or a terminal Q2 instance restarts when the exact resolution is delivered again.
test('quest resolution delivers activation to its evidenced actor and never restarts any prior instance', () => {
  const w = resolved(),
    e = cause();
  const d = deliver(w, e);
  assert.ok(d?.kind === 'accepted');
  assert.deepEqual(
    JSON.parse(JSON.stringify(d.delta.ops.map((o) => ({ ...o, instance_id: 'allocated' })))),
    [
      {
        op: 'quest.activate',
        writer_group: 1,
        quest: ref('quest', 'missing_child'),
        scope: { kind: 'player', character_id: actor },
        instance_id: 'allocated',
      },
    ],
  );
  assert.equal(d.events[0].actor_id, actor);
  assert.equal(d.events[0].causation_id as string, e.id);
  assert.equal(admit('reaction', d).kind, 'accepted');
  assert.equal(admit('movement', d).kind, 'fault');
  for (const state of [
    'active',
    'objectives_complete',
    'resolved',
    'failed',
    'abandoned',
  ] as const) {
    const prior: World = {
      ...w,
      state: {
        ...w.state,
        quests: {
          ...w.state.quests,
          ['aaaaaaaa-0000-4000-8000-000000000023']: {
            quest: ref('quest', 'missing_child'),
            scope: { kind: 'player', character_id: actor as never },
            state,
          },
        },
      },
    };
    const skipped = deliver(prior);
    assert.ok(skipped?.kind === 'accepted');
    assert.deepEqual(skipped.delta.ops, []);
    assert.deepEqual(skipped.events, []);
  }
});

// Breaks: an outcome-only/wrong-quest event triggers Q2, or inconsistent source evidence
// is trusted to activate the player instead of faulting the whole proposal.
test('quest trigger matches both fields and rejects malformed source row, actor and scope', () => {
  const w = resolved();
  for (const payload of [
    { ...cause().payload, outcome: 'done' },
    { ...cause().payload, quest: ref('quest', 'mauds_cellar') },
  ])
    assert.deepEqual(triggered(w, { ...cause(), payload } as DomainEvent), []);
  for (const change of [
    (e: any) => (e.actor_id = other),
    (e: any) => (e.scope.character_id = other),
    (e: any) => (e.payload.instance_id = 'aaaaaaaa-0000-4000-8000-000000000099'),
    (e: any) => (e.payload.outcome = 'done'),
    (e: any) => (e.payload.quest = ref('quest', 'mauds_cellar')),
  ]) {
    const e = structuredClone(cause());
    change(e);
    assert.deepEqual(deliver(w, e), { kind: 'fault', code: 'precondition_failed' });
  }
  for (const row of [
    { ...w.state.quests![instance], state: 'active' },
    { ...w.state.quests![instance], scope: { kind: 'instance', world_context_id: context } },
  ])
    assert.deepEqual(
      deliver({ ...w, state: { ...w.state, quests: { [instance]: row as never } } }),
      { kind: 'fault', code: 'precondition_failed' },
    );
});

// Breaks: a reaction fault returns its error while retaining the root report's transitions.
test('a malformed reaction source discards the report and all proposal-local changes', () => {
  const prior = resolved();
  const w: World = {
    ...prior,
    state: {
      ...prior.state,
      quests: {
        [instance]: { ...prior.state.quests![instance], state: 'active', outcome: undefined },
      },
    },
  };
  const e = { ...cause(), actor_id: other as never };
  const command = { id: e.causation_id, payload: { actor_id: actor } } as never;
  const transition = { op: 'quest.transition', writer_group: 0, instance_id: instance };
  const root = accepted(
    w,
    'report',
    [
      { ...transition, from: 'active', to: 'objectives_complete' },
      { ...transition, from: 'objectives_complete', to: 'resolved', outcome: 'report' },
    ] as never,
    [e],
  );
  const result = adopt(w, admit('quest', root), command, allocator(w, command), 1);
  assert.deepEqual(result.decision, { kind: 'fault', code: 'precondition_failed' });
  assert.equal(result.world, w);
  assert.equal(result.world.state.quests![instance].state, 'active');
  assert.deepEqual(Object.keys(result.world.state.quests!), [instance]);
});

// Breaks: inserting activation into a fact sequence reorders generated fact events, or a
// repeated activation in that delivery allocates/conflicts instead of skipping its local row.
test('mixed consequences preserve fact/event order and skip a duplicate local activation', () => {
  const prior = resolved();
  const reaction = {
    ...prior.cartridge.reactions![prefix + 'reaction/start_search'],
    apply: [
      { op: 'fact.assign', fact: ref('fact', 'fen_tracks_found'), value: true },
      { op: 'quest.activate', quest: ref('quest', 'missing_child') },
      { op: 'quest.activate', quest: ref('quest', 'missing_child') },
      { op: 'fact.assign', fact: ref('fact', 'fen_tracks_found'), value: false },
    ],
  };
  const w: World = {
    ...prior,
    cartridge: {
      ...prior.cartridge,
      reactions: {
        [prefix + 'reaction/start_search']: reaction as never,
      },
    },
  };
  const e = cause();
  const command = { id: e.causation_id, payload: { actor_id: other } } as never;
  const result = adopt(
    w,
    admit('quest', accepted(w, 'report', [], [e])),
    command,
    allocator(w, command),
    1,
  );
  assert.ok(result.decision.kind === 'accepted');
  assert.deepEqual(
    result.decision.delta.ops.map((o: any) => [
      o.op,
      o.writer_group,
      o.scope.character_id,
      o.expected,
      o.value,
    ]),
    [
      ['fact.assign', 1, actor, false, true],
      ['quest.activate', 1, actor, undefined, undefined],
      ['fact.assign', 1, actor, true, false],
    ],
  );
  assert.deepEqual(
    result.decision.events.map((event: any) => [
      event.payload.type,
      event.position,
      event.payload.new,
    ]),
    [
      ['quest_resolved', 1, undefined],
      ['fact_changed', 2, true],
      ['quest_activated', 3, undefined],
      ['fact_changed', 4, false],
    ],
  );
  assert.ok(
    result.decision.events
      .slice(1)
      .every(
        (event) =>
          (event.causation_id as string) === e.id && event.correlation_id === e.correlation_id,
      ),
  );
  assert.equal(result.decision.events[2].actor_id, actor);
});

// Breaks: loader leaves the new quest refs unchecked, accepts activation under an actorless
// legacy trigger, omits quest/reaction lock ownership, or permits an older kernel API range.
test('loader rejects missing quest references, trigger misuse and missing ownership locks', () => {
  for (const [change, code] of [
    [
      (c: any) => (c.reactions[prefix + 'reaction/start_search'].on.quest.key = 'absent'),
      'UNRESOLVED_REFERENCE',
    ],
    [
      (c: any) => (c.reactions[prefix + 'reaction/start_search'].apply[0].quest.key = 'absent'),
      'UNRESOLVED_REFERENCE',
    ],
    [
      (c: any) =>
        (c.reactions[prefix + 'reaction/start_search'].on = {
          event: 'entity_entered_room',
          room: ref('room', 'reed_bank'),
        }),
      'OUTCOME_MISMATCH',
    ],
    [
      (c: any) => {
        delete c.lock.capabilities.quest;
        delete c.manifest.requires.capabilities.quest;
      },
      'UNDECLARED_CAPABILITY',
    ],
    [
      (c: any) => {
        delete c.lock.capabilities.reaction;
        delete c.manifest.requires.capabilities.reaction;
      },
      'UNDECLARED_CAPABILITY',
    ],
    [(c: any) => (c.manifest.requires.kernel_api.at_least = '1.7'), 'KERNEL_API_RANGE_INVALID'],
    [
      (c: any) => (c.reactions[prefix + 'reaction/start_search'].apply[0].quest = 'missing_child'),
      'SCHEMA_VIOLATION',
    ],
  ] as const) {
    const c = load(change);
    assert.ok(!c.ok);
    assert.equal(c.diagnostic.code, code);
  }
});

// Breaks: a notice-only unavailable recipe or an absent recipe vacuously agrees with an
// accepted perform, including the board-child channel; matching refusal must still agree.
test('Notice-only recipe admission agreement searches standalone and board-child offers', () => {
  const view = gameView(fresh());
  const action = {
    action_key: 'study_tracks',
    label: 'actions.study_tracks',
    target: { kind: 'none' },
    input: [],
    available: false,
    reason: { code: 'invalid_state' },
  };
  const notice = {
    id: tracks,
    title: 'detail.tracks.title',
    description: 'detail.tracks.description',
    actions: [action],
  };
  const command = { payload: { type: 'perform', actor_id: actor, action: 'study_tracks' } };
  for (const projection of [
    { ...view, notices: [notice] },
    {
      ...view,
      notices: [],
      notice_boards: [
        { id: instance, title: 'board.title', description: 'board.description', notices: [notice] },
      ],
    },
  ]) {
    assert.equal(
      gameview_agrees_with_admission({ view: projection, command, decision: { kind: 'accepted' } }),
      false,
    );
    assert.equal(
      gameview_agrees_with_admission({
        view: projection,
        command,
        decision: { kind: 'rejected', error: { code: 'invalid_state' } },
      }),
      true,
    );
    assert.equal(
      gameview_agrees_with_admission({
        view: projection,
        command,
        decision: { kind: 'rejected', error: { code: 'cooldown' } },
      }),
      false,
    );
    const available = structuredClone(projection);
    const notice = available.notices[0] ?? available.notice_boards![0].notices[0];
    notice.actions![0].available = true;
    assert.equal(
      gameview_agrees_with_admission({ view: available, command, decision: { kind: 'accepted' } }),
      true,
    );
    assert.equal(
      gameview_agrees_with_admission({
        view: available,
        command,
        decision: { kind: 'rejected', error: { code: 'invalid_state' } },
      }),
      false,
    );
  }
  assert.equal(
    gameview_agrees_with_admission({ view, command, decision: { kind: 'accepted' } }),
    false,
  );
});

// Breaks: malformed new trigger/consequence fields or malformed Notice action arrays
// cross the schema boundary. These literals are shared with the Elixir validator.
test('Q2 contracts reject malformed shapes and accept their controls', () => {
  for (const c of read('protocol/fixtures/first_search_contracts.json'))
    assert.equal(validate(c.contract, c.value).length === 0, c.valid, c.name);
});

// Breaks: recipes under board children remain duplicated on World or disappear from the
// notice projection while their exact canonical subject is still admitted by the recipe rule.
test('board-child readable recipes project exclusively on the child Notice', () => {
  const loaded = load((c) => {
    const r = c.recipes[prefix + 'recipe/study_tracks'];
    r.target = { kind: 'detail', room: ref('room', 'drowned_lantern'), detail: 'lost_whistle' };
    r.policy = { policy_version: 1, root: { op: 'all', items: [] } };
  });
  assert.ok(loaded.ok && loaded.cartridge.format === 'loka-cartridge-v2');
  let w = newWorld(loaded.cartridge, context as never, [1, 2, 3, 4]);
  for (const direction of ['north', 'east'])
    w = step(
      w,
      {
        id: 'aaaaaaaa-0000-4000-8000-000000000031',
        world_context_id: context,
        payload: { type: 'move', actor_id: actor, direction },
      } as Command,
      1,
    ).world;
  const view = gameView(w);
  assert.ok(!view.actions.some((a) => a.action_key === 'study_tracks'));
  assert.deepEqual(
    view.notice_boards![0].notices.map((n) => [
      n.id,
      n.actions?.map((a) => [a.action_key, a.available]) ?? [],
    ]),
    [
      ['58ee172d-aa6f-8023-a3c1-a1d46af6d167', [['study_tracks', true]]],
      ['f14e477f-cecc-897a-bee7-c573aa5c76c3', []],
    ],
  );
  assert.deepEqual(validate('GameView', view), []);
});
