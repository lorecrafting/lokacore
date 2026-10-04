// M1-A: new elapsed/profile trust boundaries. Literal IDs/times come from frozen fixtures
// and independent elapsed_command_id.json; legacy schedule tests retain their original oracle.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { encode } from '../src/foundation/canonical.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import type { Command, Key, StoryRunId, WorldContextId } from '../src/contracts.gen.ts';
import { resolved } from '../src/commands/actions.ts';
import {
  loadCartridge,
  INSTALLED,
  newWorld,
  step,
  stepElapsed,
  type Cartridge,
  type World,
} from '../src/index.ts';
import { read } from './read.ts';
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId;
const RUN = '6f6f6f6f-1111-4222-8333-444444444444' as StoryRunId;
const F = 'ashmere_ferry@0.0.1';
function source() {
  const c = structuredClone(read('protocol/fixtures/cartridge_ferry_hash.json').value);
  c.manifest.time_policy = { profile: 'real_elapsed', rate: 50 };
  c.manifest.requires.kernel_api.at_least = '1.1';
  delete c.recipes[`${F}:recipe/coil_rope`].duration;
  return c;
}
function load(c: any) {
  const canonical = encode(c);
  const h = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${h}"}`),
    INSTALLED,
  );
}
function world() {
  const loaded = load(source());
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT, [1, 2, 3, 4]);
}
const command = (w: World, until = 68400): Command => ({
  id: elapsedCommandId(RUN, CONTEXT, w.state.clock, until) as Command['id'],
  world_context_id: CONTEXT,
  payload: { type: 'elapsed', actor_id: w.character, run_id: RUN, from: w.state.clock, until },
});
const alias = (command: string) => ({
  key: 'clock_alias',
  command,
  label: 'action.wait',
  accessibility: 'action.wait',
  priority: 0,
  target: { kind: 'none' },
  input: ['until'],
  policy: { policy_version: 1, root: { op: 'all', items: [] } },
});
const withAlias = (w: World, name: string) =>
  ({
    ...w,
    cartridge: {
      ...w.cartridge,
      actions: { [`${F}:action/clock_alias`]: alias(name) },
    },
  }) as unknown as World;

// Breaks: trusted delivery bypassing proposal/adoption or resetting causation/RNG during advance.
test('trusted elapsed advances and drains the existing due job with its owned event', () => {
  const w = world();
  const c = command(w);
  assert.equal(c.id, '9293401f-d48d-8e4e-aa5e-e773cf894076');
  const out = stepElapsed(w, c, 1);
  assert.equal(out.decision.kind, 'accepted');
  if (out.decision.kind !== 'accepted') return;
  assert.equal(out.decision.outcome, 'elapsed');
  assert.deepEqual(out.decision.delta.ops[0], {
    op: 'time.advance',
    writer_group: 0,
    from: 21600,
    to: 68400,
  });
  assert.equal(out.world.state.clock, 68400);
  assert.equal(
    out.world.state.containers['ff864ad5-cd56-80c8-9392-dc88bdc28fd2'],
    '91fde0fc-dd14-846f-826e-245e45d16ec7',
  );
  assert.deepEqual(
    out.decision.events.map((e) => [e.payload.type, e.logical_time]),
    [['entity_entered_room', 68400]],
  );
  assert.deepEqual(out.decision.effects, []);
  assert.equal(out.world.state.rng, w.state.rng);
  assert.equal(out.decision.narration, undefined);
  // Normal elapsed gameplay pays movement and changes room without synthesizing a clock charge.
  const moved = step(
    out.world,
    {
      id: 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b' as Command['id'],
      world_context_id: CONTEXT,
      payload: { type: 'move', actor_id: w.character, direction: 'north' as Key },
    },
    2,
  );
  assert.equal(moved.decision.kind, 'accepted');
  if (moved.decision.kind !== 'accepted') return;
  assert.equal(moved.world.state.clock, 68400);
  assert.equal(moved.world.state.containers[w.body], '91fde0fc-dd14-846f-826e-245e45d16ec7');
  const paid = moved.decision.delta.ops.find((op) => op.op === 'resource.adjust');
  assert.ok(paid && paid.op === 'resource.adjust');
  assert.deepEqual([paid.from, paid.to], [82, 81]);
});

// Breaks: elapsed accepting an unrelated ID, wrong identity/profile, or stale/backward interval.
test('trusted elapsed rejects invalid identity and intervals without adopting anything', () => {
  const w = world();
  const c = command(w);
  const p = c.payload as Extract<Command['payload'], { type: 'elapsed' }>;
  const legacy = {
    ...w,
    cartridge: { ...w.cartridge, manifest: { ...w.cartridge.manifest, time_policy: undefined } },
  };
  for (const [base, input, code] of [
    [
      w,
      {
        ...c,
        id: elapsedCommandId('bad-run', CONTEXT, 21600, 68400),
        payload: { ...p, run_id: 'bad-run' },
      },
      'permission_denied',
    ],
    [w, { ...c, id: '00000000-0000-0000-0000-000000000000' }, 'permission_denied'],
    [w, { ...c, id: 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b' }, 'permission_denied'],
    [w, { ...c, world_context_id: w.body }, 'not_found'],
    [w, { ...c, payload: { ...p, actor_id: w.body } }, 'not_found'],
    [
      w,
      { ...c, id: elapsedCommandId(RUN, CONTEXT, 21601, 68400), payload: { ...p, from: 21601 } },
      'invalid_state',
    ],
    [w, command(w, 21600), 'invalid_state'],
    [legacy, c, 'invalid_state'],
  ] as [World, Command, string][]) {
    const out = stepElapsed(base, input, 1);
    assert.deepEqual(out.decision, { kind: 'rejected', error: { code } });
    assert.equal(out.world, base);
  }
});

// Breaks: removing the default entry's authority guard lets a forged offered alias bypass trust.
test('normal player step cannot admit elapsed even through an offered alias', () => {
  const w = withAlias(world(), 'elapsed');
  const out = step(w, command(w), 1, 'clock_alias' as Key);
  assert.deepEqual(out.decision, { kind: 'rejected', error: { code: 'permission_denied' } });
  assert.equal(out.world, w);
});

// Breaks: projecting a Wait affordance after opting into elapsed time.
test('elapsed ActionSet offers neither Wait nor the authority elapsed command', () => {
  const w = world();
  const set = resolved(w, w.character);
  assert.equal(
    Object.values(set).some((a) => a.command === 'wait' || a.command === 'elapsed'),
    false,
  );
});

// Breaks: a custom action resolving to Wait bypassing the elapsed no-skip admission rule.
test('elapsed player Wait refuses even when a forged alias offers it', () => {
  const w = withAlias(world(), 'wait');
  const c = {
    ...command(w),
    payload: { type: 'wait', actor_id: w.character, until: 68400 },
  } as Command;
  const out = step(w, c, 1, 'clock_alias' as Key);
  assert.deepEqual(out.decision, { kind: 'rejected', error: { code: 'permission_denied' } });
  assert.equal(out.world, w);
});

// Breaks: the loader admitting a cartridge whose old kernel range falsely claims elapsed support.
test('elapsed loader requires the new kernel API and schedule owner', () => {
  for (const [change, code, path] of [
    [
      (c: any) => (c.manifest.requires.kernel_api.at_least = '1.0'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [
      (c: any) => {
        delete c.lock.capabilities.schedule;
        delete c.manifest.requires.capabilities.schedule;
      },
      'UNDECLARED_CAPABILITY',
      '.cartridge.manifest.time_policy',
    ],
  ] as [(c: any) => void, string, string][]) {
    const c = source();
    change(c);
    const out = load(c);
    assert.equal(out.ok, false);
    if (!out.ok) assert.deepEqual([out.diagnostic.code, out.diagnostic.path], [code, path]);
  }
});

// Breaks: authoring an authority elapsed action or an elapsed-profile Wait alias.
test('loader rejects authority elapsed actions and elapsed Wait aliases', () => {
  for (const name of ['elapsed', 'wait']) {
    const c = source();
    c.actions[`${F}:action/clock_alias`] = alias(name);
    const out = load(c);
    assert.equal(out.ok, false);
    if (!out.ok)
      assert.deepEqual(
        [out.diagnostic.code, out.diagnostic.path],
        ['UNKNOWN_COMMAND', `.cartridge.actions["${F}:action/clock_alias"].command`],
      );
  }
});

// Breaks: an elapsed recipe retaining a synthetic duration skip, including failed outcomes.
test('loader rejects duration in elapsed profiles while the frozen legacy fixture loads', () => {
  const c = source();
  c.recipes[`${F}:recipe/coil_rope`].duration = 3600;
  const out = load(c);
  assert.equal(out.ok, false);
  if (!out.ok)
    assert.deepEqual(
      [out.diagnostic.code, out.diagnostic.path],
      ['INVALID_TIME_POLICY', `.cartridge.recipes["${F}:recipe/coil_rope"].duration`],
    );
  assert.equal(load(read('protocol/fixtures/cartridge_ferry_hash.json').value).ok, true);
});
