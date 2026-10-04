// position@1 (c1-position; mechanics.md position@1, movement@1; protocol.md GameView): stand, sit,
// rest and sleep by invocation over the rest known answer (protocol/fixtures/cartridge_rest_hash.json,
// Python), the standing check on move, the GameView's position and listing, and the loader's
// RESERVED_FACT. Expected values are hand-derived from the cartridge files and the FactSpec in
// cartridge.md Compiler; ids are the fixture's Python ones.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Command, DefinitionRef, GameView, StoryRunId } from '../src/contracts.gen.ts';
import { encode, hash } from '../src/foundation/canonical.ts';
import { compose, key } from '../src/foundation/compose.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { resolved } from '../src/commands/actions.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { check } from '../src/runtime/invariants.ts';
import {
  admit,
  adopt,
  gameView,
  holds,
  INSTALLED,
  newWorld,
  step,
  stepElapsed,
} from '../src/runtime/world.ts';
import { read } from './read.ts';
import { allocator } from '../src/runtime/decision.ts';
import { base } from '../src/runtime/apply.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { level } from '../src/mechanics/resource.ts';
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const BODY = '3d4829ad-9e43-81ef-bc10-66b1b267e157'; // 1
const R = 'ashmere_rest@0.0.1';
const FACT = {
  cartridge_id: 'ashmere_rest',
  cartridge_version: '0.0.1',
  kind: 'fact',
  key: 'position',
};
// A known answer's artifact (its value changed by `f` and re-hashed), loaded or its first diagnostic.
const loadKat = (name: string, f?: (c: any) => void, installed = INSTALLED) => {
  const kat = read(`protocol/fixtures/cartridge_${name}_hash.json`);
  let [text, h] = [kat.canonical, kat.sha256];
  if (f) {
    const c = structuredClone(kat.value);
    f(c);
    text = encode(c);
    h = createHash('sha256').update(text).digest('hex');
  }
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`),
    installed,
  );
  return r.ok ? r : (r as any).diagnostic;
};
const world = (f?: (c: any) => void, installed = INSTALLED): World => {
  const loaded = loadKat('rest', f, installed);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], [1, 2, 3, 4]);
};
// One invocation through identify, resolve and step, with gameview_agrees_with_admission checked
// against the view before it and facts_typed after it.
function invoke(w: World, action_key: string, input = {}) {
  const value = {
    invocation_id: CONTEXT,
    actor_id: w.character,
    action_key,
    target_ids: [],
    input,
  };
  const id = identify('scope', w.character, value);
  if (id.kind !== 'identified') throw new Error(JSON.stringify(id));
  const command = resolve(w, id) as Command;
  const s = step(w, command, 0, action_key as never);
  const resolves = Object.fromEntries(
    Object.values(resolved(w, w.character)).map((a) => [a.key, a.command]),
  );
  const observation = { view: gameView(w), command, decision: s.decision, resolves, action_key };
  assert.ok(check('gameview_agrees_with_admission', observation), action_key);
  assert.ok(holds('facts_typed', s.world), `facts_typed after ${action_key}`);
  return s;
}
type Row = [string, string, object?]; // action key, outcome or refusal code, input
// Runs `rows` from `w`: each accepted with its outcome, or refused with its code and no change.
function run(w: World, rows: Row[]) {
  for (const [k, want, input] of rows) {
    const s = invoke(w, k, input);
    const got =
      s.decision.kind === 'accepted' ? s.decision.outcome : (s.decision as any).error.code;
    assert.equal(got, want, k);
    if (s.decision.kind !== 'accepted') assert.equal(s.world, w, `${k} changed the world`);
    w = s.world;
  }
  return w;
}
const north = { direction: 'north' };
const place = (v: GameView): string[] => v.actions.map((a) => a.action_key);
// An accepted decision's ops and event payloads, as JSON.
const effects = (w: World, k: string) => {
  const d = invoke(w, k).decision;
  assert.equal(d.kind, 'accepted', k);
  return JSON.parse(
    JSON.stringify(d.kind === 'accepted' && [d.delta.ops, d.events.map((e) => e.payload)]),
  );
};
const assign = (expected: string, value: string) => ({
  op: 'fact.assign',
  writer_group: 0,
  fact: FACT,
  scope: { kind: 'player', character_id: 'bd595711-ea5f-89a5-abb0-046cd349d2f9' },
  expected,
  value,
});
// Breaks: the engine fact stored at the start (a record in a fresh world, or ids moved), the
// GameView without position, or the current position's verb listed.
test('a fresh world: no position record, the same state as without position@1, standing', () => {
  const w = world();
  assert.equal(w.character, 'bd595711-ea5f-89a5-abb0-046cd349d2f9'); // 0
  assert.equal(w.body, BODY);
  assert.deepEqual(w.state.facts ?? {}, {});
  const without = world((c) => {
    for (const caps of [c.manifest.requires.capabilities, c.lock.capabilities]) {
      delete caps.position;
      delete caps.fact;
    }
    delete c.facts[`${R}:fact/position`];
  });
  assert.equal(hash(w.state as never), hash(without.state as never));
  const v = gameView(w);
  assert.equal(v.position, 'standing');
  assert.deepEqual(place(v).sort(), ['move', 'rest', 'scan', 'sit', 'sleep', 'wait']);
  assert.equal(gameView(without).position, undefined);
  assert.ok(!place(gameView(without)).includes('sit'));
});
// Breaks: move not checking position, or before passage; the same position accepted; expected
// hard-coded to standing; the exit not shown invalid_state; the current verb listed.
test('the position walk by invocation: only move needs standing, after the door', () => {
  const w0 = world();
  assert.deepEqual(effects(w0, 'sit'), [
    [assign('standing', 'sitting')],
    [{ type: 'fact_changed', fact: FACT, old: 'standing', new: 'sitting' }],
  ]);
  let w = run(w0, [
    ['sit', 'sat'],
    ['sit', 'invalid_state'],
    ['move', 'exit_closed', north],
    ['open', 'opened', north],
    ['move', 'invalid_state', north],
  ]);
  const v = gameView(w);
  assert.equal(v.position, 'sitting');
  assert.deepEqual(place(v).sort(), ['move', 'rest', 'scan', 'sleep', 'stand', 'wait']);
  const exit = v.exits.find((e) => e.direction === 'north')!;
  assert.deepEqual([exit.available, (exit as any).reason], [false, { code: 'invalid_state' }]);
  assert.deepEqual(effects(w, 'rest')[0], [assign('sitting', 'resting')]);
  w = run(w, [
    ['rest', 'rested'],
    ['rest', 'invalid_state'],
    ['sleep', 'slept'],
    ['sleep', 'invalid_state'],
    ['stand', 'stood'],
    ['stand', 'invalid_state'],
    ['rest', 'rested'],
    ['stand', 'stood'],
    ['sleep', 'slept'],
    ['sit', 'sat'],
    ['stand', 'stood'],
    ['sit', 'sat'],
    ['sleep', 'slept'],
    ['rest', 'rested'],
    ['sit', 'sat'],
    ['stand', 'stood'],
    ['move', 'moved', north],
  ]);
  assert.equal(gameView(w).position, 'standing');
});
// Breaks: an alias of a position verb listed while it is the current position (listing by key,
// not by resolved command), or the invariant treating an alias's failed policy as a failure of
// the available engine verb.
test('a cartridge alias of sit is listed and dropped with sit, with its own policy', () => {
  const aliased = (allow = true) =>
    world((c) => {
      Object.assign(c.text, { 'action.kneel': 'Kneel', 'action.kneel.a11y': 'Kneel down' });
      for (const caps of [c.manifest.requires.capabilities, c.lock.capabilities]) caps.policy = 1;
      c.actions[`${R}:action/kneel`] = {
        key: 'kneel',
        command: 'sit',
        target: { kind: 'none' },
        input: [],
        label: 'action.kneel',
        accessibility: 'action.kneel.a11y',
        priority: 0,
        policy: {
          policy_version: 1,
          root: {
            op: 'all',
            items: allow ? [] : [{ op: 'fact_compare', fact: FACT, equals: 'sitting' }],
          },
        },
      };
    });
  const w = aliased();
  assert.ok(place(gameView(w)).includes('kneel'));
  const sat = run(w, [['kneel', 'sat']]);
  assert.ok(!place(gameView(sat)).includes('kneel'));
  assert.ok(!place(gameView(sat)).includes('sit'));
  run(sat, [
    ['kneel', 'invalid_state'],
    ['stand', 'stood'],
  ]);
  const denied = aliased(false);
  assert.equal(gameView(denied).actions.find((a) => a.action_key === 'kneel')!.available, false);
  run(denied, [
    ['kneel', 'invalid_state'],
    ['sit', 'sat'],
  ]);
});
// Breaks: a position regeneration bonus (00 §4.2 position bonuses are LATER).
test('no position changes regeneration: mv 1 at 0 is 19 at 3600, standing, resting or asleep', () => {
  const mv = {
    cartridge_id: 'ashmere_rest',
    cartridge_version: '0.0.1',
    kind: 'resource',
    key: 'mv',
  };
  const w0 = world();
  const row = key({ kind: 'resource', resource: mv, entity_id: BODY } as never);
  const w = { ...w0, state: { ...w0.state, resources: { [row]: { value: 1, at: 0 } } } } as World;
  const level = (x: World) => gameView(x).resources!.find((r) => r.resource.key === 'mv')!.current;
  assert.equal(level(w), 1);
  for (const before of [[], [['rest', 'rested']], [['sleep', 'slept']]] as Row[][]) {
    const x = run(run(w, before), [['wait', 'waited', { until: 3600 }]]);
    assert.equal(level(x), 19, JSON.stringify(before));
  }
});
const diag = (path: string) => ({
  severity: 'error',
  code: 'RESERVED_FACT',
  path,
  message_key: 'diagnostics.reserved_fact',
  data: {},
  suggested_capabilities: [],
});
const F = 'ashmere_ferry@0.0.1';
const fact = (k: string) => ({
  cartridge_id: 'ashmere_ferry',
  cartridge_version: '0.0.1',
  kind: 'fact',
  key: k,
});
// The ferry known answer with position@1 (and reaction@1) locked and the engine FactSpec added,
// then changed by `f`.
const ferry = (f: (c: any) => void) =>
  loadKat('ferry', (c) => {
    for (const caps of [c.manifest.requires.capabilities, c.lock.capabilities])
      Object.assign(caps, { position: 1, reaction: 1 });
    c.facts[`${F}:fact/position`] = structuredClone(
      read('protocol/fixtures/cartridge_rest_hash.json').value.facts[`${R}:fact/position`],
    );
    f(c);
  });
const write = { op: 'fact.assign', fact: fact('position'), value: 'sitting' };

// Breaks: each write-site check dropped, the FactSpec comparison skipped or a missing spec
// accepted, or a read refused.
test('the loader refuses content writing the position fact, and a wrong or missing spec', () => {
  assert.ok(ferry(() => {}).ok, JSON.stringify(ferry(() => {})));
  const recipe = (c: any) =>
    c.recipes[`${F}:recipe/coil_rope`].outcomes.success.sequence.unshift(write);
  assert.deepEqual(
    ferry(recipe),
    diag(`.cartridge.recipes["${F}:recipe/coil_rope"].outcomes.success.sequence[0].fact`),
  );
  const choice = (c: any) => (c.dialogues[`${F}:dialogue/bram`].choices.carry.sequence[0] = write);
  assert.deepEqual(
    ferry(choice),
    diag(`.cartridge.dialogues["${F}:dialogue/bram"].choices.carry.sequence[0].fact`),
  );
  const reaction = (apply: object[], when?: object) => (c: any) =>
    (c.reactions = {
      [`${F}:reaction/settle`]: {
        key: 'settle',
        on: { event: 'fact_changed', fact: fact('search_plan') },
        ...(when && { when: { policy_version: 1, root: when } }),
        apply,
      },
    });
  assert.deepEqual(
    ferry(reaction([write])),
    diag(`.cartridge.reactions["${F}:reaction/settle"].apply[0].fact`),
  );
  const reads = { op: 'fact_compare', fact: fact('position'), equals: 'sitting' };
  const ok = [{ op: 'fact.assign', fact: fact('search_plan'), value: 'party_led' }];
  assert.ok(ferry(reaction(ok, reads)).ok); // reading is allowed
  const spec = (f: (s: any) => void) => (c: any) => f(c.facts[`${F}:fact/position`]);
  const at = diag(`.cartridge.facts["${F}:fact/position"]`);
  assert.deepEqual(ferry(spec((s) => s.value_type.values.push('flying'))), at);
  assert.deepEqual(ferry(spec((s) => (s.meaning += 'x'))), at);
  assert.deepEqual(
    ferry((c) => delete c.facts[`${F}:fact/position`]),
    at,
  );
  // Without position@1 the fact and its write are the cartridge's own.
  const own = (c: any) => {
    for (const caps of [c.manifest.requires.capabilities, c.lock.capabilities])
      delete caps.position;
    recipe(c);
  };
  assert.ok(ferry(own).ok);
});

// Controlled opt-in over the frozen rest cartridge; the recovery API installs in the later lane.
const recoveryInstalled = { ...INSTALLED, kernel_api: '1.2' };
const MV: DefinitionRef = { ...FACT, kind: 'resource', key: 'mv' } as DefinitionRef;
const poolTarget = { kind: 'resource', resource: MV, entity_id: BODY };
const recoverySource = (c: any, birth = 64800) => {
  c.manifest.time_policy = { profile: 'real_elapsed', rate: 50 };
  c.manifest.requires.kernel_api.at_least = '1.2';
  c.calendar = { start: birth };
  for (const capabilities of [c.manifest.requires.capabilities, c.lock.capabilities])
    capabilities.calendar = 1;
  Object.assign(c.resources[`${R}:resource/mv`], {
    minimum: 0,
    maximum: 10,
    start: 0,
    regen: {
      every: 10,
      by_position: { standing: 2, sitting: 2, resting: 4, sleeping: 4 },
    },
  });
};
const recovering = (birth = 64800) => world((c) => recoverySource(c, birth), recoveryInstalled);
const pool = (w: World) => w.state.resources?.[key(poolTarget)];
function elapsed(w: World, until: number): World {
  const run = '6f6f6f6f-1111-4222-8333-444444444444' as StoryRunId;
  const command: Command = {
    id: elapsedCommandId(run, w.context, w.state.clock, until) as Command['id'],
    world_context_id: w.context,
    payload: { type: 'elapsed', actor_id: w.character, run_id: run, from: w.state.clock, until },
  };
  const result = stepElapsed(w, command, 1);
  assert.equal(result.decision.kind, 'accepted');
  return result.world;
}

// Breaks: paying the destination rate retroactively, omitting from==to, resetting fractions or wrong command mapping.
test('elapsed Rest/Stand/Sit/Sleep settles old rates and retains literal metadata', () => {
  let w = recovering();
  const legacy = Object.fromEntries(
    Object.entries(w.state.resources!).filter(([k]) => k !== key(poolTarget)),
  );
  w = run(elapsed(w, 64803), [['rest', 'rested']]);
  assert.deepEqual(pool(w), { value: 0, at: 64803, rate: 4, remainder: 6 });
  assert.equal(gameView(w).position, 'resting');
  w = run(elapsed(w, 64805), [['stand', 'stood']]);
  assert.deepEqual(pool(w), { value: 1, at: 64805, rate: 2, remainder: 4 });
  assert.equal(level(elapsed(w, 64808), w.body, MV), 2);
  w = run(elapsed(w, 64806), [['sit', 'sat']]);
  assert.deepEqual(pool(w), { value: 1, at: 64806, rate: 2, remainder: 6 });
  w = run(elapsed(w, 64808), [['sleep', 'slept']]);
  assert.deepEqual(pool(w), { value: 2, at: 64808, rate: 4, remainder: 0 });
  assert.equal(level(elapsed(w, 64811), w.body, MV), 3);
  w = run(elapsed(w, 64809), [['rest', 'rested']]);
  assert.deepEqual(pool(w), { value: 2, at: 64809, rate: 4, remainder: 4 });
  assert.deepEqual(
    Object.fromEntries(Object.entries(w.state.resources!).filter(([k]) => k !== key(poolTarget))),
    legacy,
  );
});

// Breaks: clock-zero births omit opted rows, calendar births receive time-zero free recovery, or queries write metadata.
test('opted births at zero and calendar start earn only their own elapsed interval', () => {
  for (const birth of [0, 64800]) {
    const w = recovering(birth);
    assert.deepEqual(pool(w), { value: 0, at: birth, rate: 2, remainder: 0 });
    const advanced = elapsed(w, birth + 5);
    assert.equal(level(advanced, w.body, MV), 1);
    assert.equal(advanced.state.resources, w.state.resources);
    assert.deepEqual(pool(advanced), { value: 0, at: birth, rate: 2, remainder: 0 });
  }
});

// Breaks: a sleeping/sitting command accidentally selects another position with the same default rate.
test('distinct authored Sit/Sleep rates select the commanded position', () => {
  const w = world((c) => {
    recoverySource(c);
    Object.assign(c.resources[`${R}:resource/mv`].regen.by_position, { sitting: 1, sleeping: 3 });
  }, recoveryInstalled);
  const sitting = run(elapsed(w, 64802), [['sit', 'sat']]);
  assert.deepEqual(pool(sitting), { value: 0, at: 64802, rate: 1, remainder: 4 });
  const sleeping = run(elapsed(sitting, 64808), [['sleep', 'slept']]);
  assert.deepEqual(pool(sleeping), { value: 1, at: 64808, rate: 3, remainder: 0 });
  assert.equal(level(elapsed(sleeping, 64812), w.body, MV), 2);
});

// Breaks: final adopt accepts an authored but wrong rate, an omitted position pool, or a pool-only rate change.
test('the public admitted proposal path faults rate/position disagreement before acceptance', () => {
  const w = elapsed(recovering(), 64803);
  const op = {
    op: 'resource.adjust',
    writer_group: 0,
    resource: MV,
    entity_id: BODY,
    from: 0,
    to: 0,
    next_rate: 2,
  };
  const command = {
    id: CONTEXT,
    world_context_id: CONTEXT,
    payload: { type: 'rest' as const, actor_id: w.character },
  } as Command & { payload: { type: 'rest'; actor_id: World['character'] } };
  assert.deepEqual(compose(base(w), { ops: [op] as never }), {
    changes: [{ target: poolTarget, value: { value: 0, at: 64803, rate: 2, remainder: 6 } }],
  }); // Portable membership is legal; the RPG must reject only the final disagreement.
  for (const ops of [
    [op, assign('standing', 'resting')],
    [assign('standing', 'resting')],
    [{ ...op, next_rate: 4 }],
  ]) {
    const proposed = admit('position', {
      kind: 'accepted',
      outcome: 'rested' as never,
      delta: { ops } as never,
      events: [],
      effects: [],
      rng: [9, 8, 7, 6] as never,
    });
    const out = adopt(w, proposed, command, allocator(w, command), 1);
    assert.deepEqual(out.decision, {
      kind: 'fault',
      code: 'precondition_failed',
      target: poolTarget,
    });
    assert.equal(out.world, w);
  }
});

// Breaks: recovery loads without its required capability/time profile/API or violates the exact residual-product bound.
test('recovery loader checks actual opt-in dependencies and arithmetic bound', () => {
  const cases: [string, string, (c: any) => void][] = [
    [
      'UNDECLARED_CAPABILITY',
      `.cartridge.resources["${R}:resource/mv"].regen`,
      (c) => {
        delete c.manifest.requires.capabilities.position;
        delete c.lock.capabilities.position;
      },
    ],
    [
      'INVALID_TIME_POLICY',
      `.cartridge.resources["${R}:resource/mv"].regen`,
      (c) => {
        delete c.manifest.time_policy;
      },
    ],
    [
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
      (c) => {
        c.manifest.requires.kernel_api.at_least = '1.1';
      },
    ],
    [
      'RESOURCE_SPEC_INVALID',
      `.cartridge.resources["${R}:resource/mv"].regen`,
      (c) => {
        c.resources[`${R}:resource/mv`].regen = {
          every: 4194304,
          by_position: { standing: 2147483647, sitting: 0, resting: 0, sleeping: 0 },
        };
      },
    ],
  ];
  for (const [code, path, change] of cases) {
    const loaded = loadKat(
      'rest',
      (c) => {
        recoverySource(c);
        change(c);
      },
      recoveryInstalled,
    );
    assert.equal(loaded.code, code);
    assert.equal(loaded.path, path);
  }
  const loaded = loadKat(
    'rest',
    (c) => {
      recoverySource(c);
      c.resources[`${R}:resource/mv`].regen = {
        every: 4194303,
        by_position: { standing: 2147483647, sitting: 0, resting: 0, sleeping: 0 },
      };
    },
    recoveryInstalled,
  );
  assert.equal(loaded.ok, true);
});
