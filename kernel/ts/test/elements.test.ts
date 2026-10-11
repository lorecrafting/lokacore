// Status readers 1 to 3 (row G3; Beads loka-kgd.86 to .88) on the compiled elements sampler:
// lightning landing on a wet golem stuns it, warmth landing dries it, and the loader floors.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { encode } from '../src/foundation/canonical.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { living } from '../src/mechanics/death/shared.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-elements-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/elements_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const C = 'elements_sampler@0.0.1';
const ref = (kind: string, k: string) =>
  ({ cartridge_id: 'elements_sampler', cartridge_version: '0.0.1', kind, key: k }) as never;
const fresh = (c: Cartridge = content) =>
  newWorld(c, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
const id = (w: World, kind: string, k: string) => w.entityIds[`${C}:${kind}/${k}`]!;
const golem = (w: World) => id(w, 'npc', 'golem');
const hp = (w: World) => level(w, golem(w), resourceRef(w, 'hp'));
const active = (w: World, body: string, status: string) =>
  w.state.statuses?.[key({ kind: 'status', body_id: body, status: ref('status', status) })]
    ?.active === true;
const on = (w: World, status: string) => active(w, golem(w), status);
// The sampler with its reactions edited.
const edited = (edit: (r: Record<string, any>) => void) => {
  const reactions = structuredClone(content.reactions!) as Record<string, any>;
  edit(reactions);
  return { ...content, reactions } as Cartridge;
};
const rule = (k: string) => `${C}:reaction/${k}`;

let n = 0;
function run(w: World, p: object) {
  n += 1;
  return step(
    w,
    {
      id: `cccccccc-4444-4333-8444-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
}
let applied: string[] = []; // status_applied events of the last drop, as "holder status"
// Take the item and drop it in the yard, which fires its reaction.
function drop(w: World, item: string): World {
  w = run(w, { type: 'take', item_id: id(w, 'item', item) }).world;
  const r = run(w, { type: 'drop', item_id: id(w, 'item', item) });
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  applied =
    r.decision.kind === 'accepted'
      ? r.decision.events.flatMap((e) =>
          e.payload.type === 'status_applied'
            ? [
                `${e.payload.body_id === golem(w) ? 'golem' : e.payload.body_id} ${e.payload.status.key}`,
              ]
            : [],
        )
      : [];
  return r.world;
}
function wait(w: World, seconds: number): World {
  n += 1;
  const run_id = 'aaaaaaaa-0000-4000-8000-000000000010';
  const until = w.state.clock + seconds;
  const r = stepElapsed(
    w,
    {
      id: elapsedCommandId(run_id, w.context, w.state.clock, until) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id, from: w.state.clock, until },
    } as never,
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}

// Breaks: status_active subject reading the action's target (none in a reaction, so false), no
// status_applied on a first application, a reaction status.cure that writes nothing, or a cure
// outside the golem's writer group in this advance (the drop then faults on the shocked row).
test('lightning landing on a wet golem stuns it and ends shocked and wet', () => {
  const w = drop(drop(fresh(), 'bucket'), 'jar');
  assert.deepEqual(applied, ['golem shocked', 'golem stunned']);
  assert.deepEqual(
    ['wet', 'shocked', 'stunned'].map((s) => on(w, s)),
    [false, false, true],
  );
  assert.equal(hp(wait(w, 60)), 17); // stunned's -3; a live shocked would make it 16
  // Control: on a dry golem the jar only shocks.
  const dry = drop(fresh(), 'jar');
  assert.deepEqual(applied, ['golem shocked']);
  assert.equal(hp(wait(dry, 60)), 19);
});

// Breaks (loka-6ztc): one advance misses the successor a tick schedules (precondition_failed on
// the shocked row), or a crossed sub-step reads the row's stale next tick (the advance faults), or
// ticks at the end it shares with the last tick. Job by job: ticks at 60 and 120, ends at 180.
// The golem shocked for 180 s at `per_tick`, then one advance of 180 s.
function shockedFor180(per_tick: number) {
  const statuses = structuredClone(content.statuses!) as Record<string, any>;
  Object.assign(statuses[`${C}:status/shocked`], { duration: 180, per_tick });
  return wait(drop(fresh({ ...content, statuses } as Cartridge), 'jar'), 180);
}
test('one advance across every tick and the end of a status matches job-by-job play', () => {
  const w = shockedFor180(-1);
  assert.deepEqual([hp(w), on(w, 'shocked')], [18, false]);
});

// Breaks (loka-6ztc): a fatal tick on a crossed sub-step (no job.complete before its hp loss)
// hands the death sequence the wrong op. Job by job: 20 - 10 at 60, 0 at 120, dead.
test('a fatal tick on a crossed sub-step kills the golem as job-by-job play does', () => {
  const w = shockedFor180(-10);
  assert.deepEqual([hp(w), on(w, 'shocked'), living(w, golem(w))], [0, false, false]);
});

// Breaks (loka-6ztc): a reaction refreshing shocked on its tick inside one advance copies the row's
// stale next tick (precondition_failed), or a sub-step at the old end ticks there. Shocked 90 s,
// a tick each 60 s, re-applied on each tick; one advance against 10 s waits.
test('a status refreshed on its tick inside one advance matches job-by-job play', () => {
  const statuses = structuredClone(content.statuses!) as Record<string, any>;
  statuses[`${C}:status/shocked`].duration = 90;
  const refresh = edited((r) => {
    r[rule('zz_reshock')] = {
      key: 'zz_reshock',
      on: { event: 'status_ticked', status: ref('status', 'shocked') },
      apply: [{ op: 'status.apply', status: ref('status', 'shocked') }],
    };
  });
  const start = drop(fresh({ ...refresh, statuses } as Cartridge), 'jar');
  const row = (w: World) => {
    const r = w.state.statuses![
      key({ kind: 'status', body_id: golem(w), status: ref('status', 'shocked') })
    ] as any;
    return [hp(w), r.active, r.ends_at - start.state.clock, r.next_tick_at - start.state.clock];
  };
  for (const [seconds, expected] of [
    [90, [19, true, 150, 120]],
    [95, [19, true, 150, 120]],
    [130, [18, true, 210, 180]],
  ] as const) {
    let stepped = start;
    for (let t = 0; t < seconds; t += 10) stepped = wait(stepped, Math.min(10, seconds - t));
    assert.deepEqual(row(stepped), expected);
    assert.deepEqual(row(wait(start, seconds)), expected);
  }
});

// Breaks: status_applied emitted with no reaction listening, so every cartridge applying a status
// by reaction gains events and receipts it never opted into (the opt-in, as W25's clock_hour).
test('with no status_applied reaction a landing emits nothing', () => {
  const quiet = edited((r) => {
    delete r[rule('shock_on_wet')];
    delete r[rule('warmth_dries')];
  });
  const w = drop(fresh(quiet), 'jar');
  assert.deepEqual(applied, []);
  assert.equal(on(w, 'shocked'), true);
});

// Breaks: status.cure ignored as a reaction step, or warm's status_applied never delivered.
test('warmth landing dries the golem, so lightning no longer stuns', () => {
  let w = drop(drop(fresh(), 'bucket'), 'torch');
  assert.deepEqual([on(w, 'warm'), on(w, 'wet')], [true, false]);
  w = drop(w, 'jar');
  assert.deepEqual([on(w, 'shocked'), on(w, 'stunned')], [true, false]);
});

// Breaks: subject read as the actor's body (or self as the event's subject): only the player is wet.
test('subject reads the shocked golem and self the wet player', () => {
  const soaked = (subject: string) =>
    edited((r) => {
      delete r[rule('drench')].apply[0].npc; // item_dropped's subject: the player's body
      r[rule('shock_on_wet')].when.root.subject = subject;
    });
  for (const [subject, stunned] of [
    ['subject', false],
    ['self', true],
  ] as const) {
    const start = drop(fresh(soaked(subject)), 'bucket');
    assert.deepEqual([active(start, start.body, 'wet'), on(start, 'wet')], [true, false]);
    assert.equal(on(drop(start, 'jar'), 'stunned'), stunned, subject);
  }
});

// Breaks: a refresh while active emitting status_applied (a rule re-applying its own trigger
// status would then cycle to budget_exceeded instead of quiescing).
test('a rule re-applying the status that triggered it quiesces: a refresh does not land', () => {
  const again = edited((r) => {
    r[rule('shock_on_wet')] = {
      key: 'shock_on_wet',
      on: r[rule('shock_on_wet')].on,
      apply: [{ op: 'status.apply', status: ref('status', 'shocked') }],
    };
  });
  const w = drop(fresh(again), 'jar');
  assert.deepEqual(applied, ['golem shocked']);
  assert.equal(on(w, 'shocked'), true);
});

// Breaks: a status.cure not sharing the rule's first-wins set with status.apply, so the cure ends
// the wet the apply just refreshed and the rule writes the wet row twice.
test('in one rule the first of an apply and a cure on one holder and status wins', () => {
  const both = edited((r) => {
    r[rule('shock_on_wet')] = {
      key: 'shock_on_wet',
      on: r[rule('shock_on_wet')].on,
      apply: [
        { op: 'status.apply', status: ref('status', 'wet') },
        { op: 'status.cure', status: ref('status', 'wet') },
      ],
    };
  });
  const wet = drop(fresh(both), 'bucket');
  const w = run(wet, { type: 'take', item_id: id(wet, 'item', 'jar') }).world;
  const r = run(w, { type: 'drop', item_id: id(w, 'item', 'jar') });
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  if (r.decision.kind !== 'accepted') return;
  const wetWrites = r.decision.delta.ops.filter(
    (o) => o.op === 'status.transition' && o.body_id === golem(w) && o.status.key === 'wet',
  );
  assert.equal(wetWrites.length, 1);
  assert.equal(on(r.world, 'wet'), true);
});

// Breaks: a cure-and-reapply cycle not cut (the step never returns) or cut and committed. By the
// existing reaction_depth budget (32, LIMITS; runtime/proposal.ts react): each landing is one level.
test('two rules that cure and re-apply each other fault budget_exceeded at reaction_depth', () => {
  const flip = (from: string, to: string) => ({
    key: `${from}_to_${to}`,
    on: { event: 'status_applied', status: ref('status', from) },
    apply: [
      { op: 'status.cure', status: ref('status', from) },
      { op: 'status.apply', status: ref('status', to) },
    ],
  });
  const cycle = edited((r) => {
    delete r[rule('shock_on_wet')];
    r[rule('shocked_to_stunned')] = flip('shocked', 'stunned');
    r[rule('stunned_to_shocked')] = flip('stunned', 'shocked');
  });
  const w = run(fresh(cycle), { type: 'take', item_id: id(fresh(cycle), 'item', 'jar') }).world;
  const r = run(w, { type: 'drop', item_id: id(w, 'item', 'jar') });
  assert.deepEqual(r.decision, { kind: 'fault', code: 'budget_exceeded' });
  assert.equal(r.limit, 'reaction_depth');
  assert.equal(r.world, w);
});

/** The sampler's artifact, edited and re-hashed, loaded: its first diagnostic's code and path. */
function reload(edit: (c: any) => void) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  c.manifest.requires.kernel_api.at_least = '1.52';
  delete c.reactions[rule('shock_on_wet')];
  delete c.reactions[rule('warmth_dries')];
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
}
const api = ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'];

// Breaks (twin of test/loka/content_elements_test.exs): a status_applied trigger, a reaction
// status.cure or a status_active leaf reading self or subject (each alone) loads under API 1.52,
// or a reaction cure of an undeclared status loads.
test('status readers need API 1.53; a reaction cure names a declared status', () => {
  assert.equal(
    reload(() => {}),
    'loaded',
  );
  const cure = { op: 'status.cure', status: ref('status', 'wet') };
  const leaf = (subject: string) => ({
    policy_version: 1,
    root: { op: 'status_active', subject, status: ref('status', 'wet') },
  });
  const spark = (c: any) => c.reactions[rule('spark')];
  for (const edit of [
    (c: any) => (spark(c).on = { event: 'status_applied' }),
    (c: any) => spark(c).apply.push(cure),
    (c: any) => (spark(c).when = leaf('self')),
    (c: any) => (spark(c).when = leaf('subject')),
  ])
    assert.deepEqual(reload(edit), api);
  assert.equal(
    reload((c) => (spark(c).when = leaf('target'))),
    'loaded',
  );
  assert.deepEqual(
    reload((c) => {
      c.manifest.requires.kernel_api.at_least = '1.53';
      spark(c).apply.push({ ...cure, status: ref('status', 'ash') });
    }),
    ['UNRESOLVED_REFERENCE', `.cartridge.reactions["${rule('spark')}"].apply[1].status`],
  );
});
