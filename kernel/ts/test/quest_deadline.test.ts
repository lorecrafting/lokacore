// Toolbox row W24 on a compiled quest_sampler copy (one real minute is 3000 logical units): find_key
// gets a generic deadline of ten minutes, a quest_failed reaction that notes the lateness and a
// fact_changed reaction that resolves the quest when the floor is searched.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';
import { begun } from '../src/mechanics/quest/lifecycle.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';

const MINUTE = 3000;
const root = fileURLToPath(new URL('../../../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'loka-quest-deadline-'));
let compiled: Obj;
try {
  const dir = join(scratch, 'quest_sampler');
  cpSync(join(root, 'cartridges/quest_sampler'), dir, { recursive: true });
  const edit = (file: string, change: (j: Obj) => void) => {
    const j = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    change(j);
    writeFileSync(join(dir, file), JSON.stringify(j));
  };
  edit('cartridge.json', (j) => (j.requires.capabilities.reaction = 1));
  edit('facts.json', (j) => {
    j.facts.late_noted = { ...j.facts.floor_searched, meaning: 'The key came too late.' };
  });
  edit('quests/find_key.json', (j) => (j.deadline = { after: 10 * MINUTE, outcome: 'late' }));
  const reactions = join(dir, 'reactions');
  mkdirSync(reactions);
  const late = { event: 'quest_failed', quest: 'find_key', outcome: 'late' };
  const resolve = { event: 'fact_changed', fact: 'floor_searched' };
  writeFileSync(
    join(reactions, 'late.json'),
    JSON.stringify({ on: late, apply: [{ op: 'fact.assign', fact: 'late_noted', value: true }] }),
  );
  writeFileSync(
    join(reactions, 'searched.json'),
    JSON.stringify({
      on: resolve,
      apply: [{ op: 'quest.resolve', quest: 'find_key', outcome: 'done' }],
    }),
  );
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', dir, file], { cwd: root, stdio: 'pipe' });
  compiled = JSON.parse(readFileSync(file, 'utf8')).cartridge;
} finally {
  rmSync(scratch, { recursive: true });
}
const QUEST = 'quest_sampler@0.0.1:quest/find_key';
const quest = {
  cartridge_id: 'quest_sampler',
  cartridge_version: '0.0.1',
  kind: 'quest',
  key: 'find_key',
};

// The compiled cartridge after `change`, through the loader (a diagnostic, or the loaded cartridge).
function load(change: (c: Obj) => void = () => {}) {
  const c = structuredClone(compiled);
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
const fresh = (change?: (c: Obj) => void) => {
  const r = load(change);
  assert.ok(r.ok, JSON.stringify(r));
  return newWorld(
    r.cartridge as Cartridge,
    '2e5f9b6d-4a2c-4d3b-8f8e-7c6b5d4e3f24' as never,
    [4, 3, 2, 1],
  );
};
let n = 0;
function play(w: World, p: object): World {
  n += 1;
  const id = `eeeeeeee-2424-4333-8444-${String(n).padStart(12, '0')}`;
  const payload = { actor_id: w.character, ...p };
  const r = step(w, { id: id as never, world_context_id: w.context, payload: payload as never }, n);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
function wait(w: World, minutes: number) {
  n += 1;
  const run_id = 'aaaaaaaa-2424-4000-8000-000000000010';
  const until = w.state.clock + minutes * MINUTE;
  const id = elapsedCommandId(run_id, w.context, w.state.clock, until);
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from: w.state.clock, until };
  const r = stepElapsed(
    w,
    { id: id as never, world_context_id: w.context, payload: payload as never },
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  const events = r.decision.kind === 'accepted' ? r.decision.events.map((e) => e.payload) : [];
  return { w: r.world, events };
}
const row = (w: World) => Object.values(w.state.quests ?? {})[0]!;
const lateNoted = (w: World) =>
  Object.entries(w.state.facts ?? {}).some(([k, v]) => k.includes('late_noted') && v === true);
const failedEvents = (events: readonly { type: string }[]) =>
  events.filter((e) => e.type === 'quest_failed');

// Breaks: the job due from started_at (taking the key at five re-stamps it, so it would fail at
// fifteen), no job scheduled, the instance not failed or failed without its outcome, no
// quest_failed event or one the reaction trigger does not match (no late_noted).
test('a generic deadline fails the open quest at activation plus after, and a reaction penalises', () => {
  let w = wait(play(fresh(), { type: 'accept_quest', quest }), 5).w;
  w = play(w, { type: 'take', item_id: w.entityIds['quest_sampler@0.0.1:item/key'] });
  assert.equal(row(w).state, 'objectives_complete');
  let r = wait(w, 4);
  assert.equal(row(r.w).state, 'objectives_complete');
  assert.deepEqual(failedEvents(r.events), []);
  r = wait(r.w, 1);
  assert.deepEqual([row(r.w).state, row(r.w).outcome], ['failed', 'late']);
  const [failed] = failedEvents(r.events) as unknown as [{ quest: Obj; outcome: string }];
  assert.deepEqual([failed.quest.key, failed.outcome], ['find_key', 'late']);
  assert.ok(lateNoted(r.w));
});

// Break: a missing or closed instance faults the job (precondition_failed) or fails it anyway.
test('a deadline job of a quest resolved earlier only completes', () => {
  let w = play(fresh(), { type: 'accept_quest', quest });
  w = play(w, { type: 'take', item_id: w.entityIds['quest_sampler@0.0.1:item/key'] });
  w = play(w, { type: 'perform', action: 'search_floor' });
  assert.equal(row(w).state, 'resolved');
  const r = wait(w, 11);
  assert.deepEqual(
    [row(r.w).state, failedEvents(r.events), lateNoted(r.w)],
    ['resolved', [], false],
  );
  assert.deepEqual(
    Object.values(r.w.state.jobs ?? {})
      .filter((j) => j.quest_instance_id)
      .map((j) => j.status),
    ['completed'],
  );
});

// Break: a deadline already past at activation faults the accept (nonfuture_job) or never expires.
test('an absolute deadline already past expires on the next advance', () => {
  const w = fresh((c) => (c.quests[QUEST].deadline = { at: 0, outcome: 'late' }));
  const accepted = play(wait(w, 1).w, { type: 'accept_quest', quest });
  assert.equal(row(accepted).state, 'active');
  const r = wait(accepted, 1);
  assert.deepEqual([row(r.w).state, failedEvents(r.events).length], ['failed', 1]);
});

// Break: the horizon read from the clock alone, so an activation inside an advance schedules a job
// at or before the advance target (nonfuture_job faults the proposal).
test('a deadline due inside the proposal advance is scheduled one past its target', () => {
  const w = fresh((c) => (c.quests[QUEST].deadline = { after: 1, outcome: 'late' }));
  const activate = {
    op: 'quest.activate',
    writer_group: 3,
    quest,
    scope: { kind: 'player', character_id: w.character },
    instance_id: 'q1',
  } as const;
  const advance = { op: 'time.advance', writer_group: 0, from: 0, to: 500 } as const;
  let k = 0;
  const ops = begun(w, [activate as never], 10, [advance], () => `j${k++}`);
  assert.deepEqual(ops[1], {
    op: 'job.schedule',
    writer_group: 3,
    job_id: 'j0',
    job: quest,
    due_time: 501,
    quest_instance_id: 'q1',
    actor_id: w.character,
  });
});

// Breaks (loader twin of test/loka/content_quest_deadline_test.exs): a mixed legacy and generic
// deadline, both or neither of after and at, a legacy one missing a field, or a generic one below
// kernel_api 1.46, loads.
test('the loader refuses a deadline that is neither legacy nor generic, and a generic one below 1.46', () => {
  const at = `.cartridge.quests["${QUEST}"].deadline`;
  const floor = '.cartridge.manifest.requires.kernel_api.at_least';
  const ref = { ...quest, kind: 'fact', key: 'floor_searched' };
  const d = (c: Obj) => c.quests[QUEST].deadline;
  const rows: [(c: Obj) => void, string, string][] = [
    [(c) => (d(c).trust_amount = -1), 'SCHEMA_VIOLATION', at],
    [(c) => (d(c).at = 5), 'SCHEMA_VIOLATION', at],
    [(c) => delete d(c).after, 'SCHEMA_VIOLATION', at],
    ...['at', 'fact', 'trust_fact', 'trust_amount'].map(
      (field): [(c: Obj) => void, string, string] => [
        (c) => {
          const full = { at: 5, outcome: 'late', fact: ref, trust_fact: ref, trust_amount: -1 };
          c.quests[QUEST].deadline = Object.fromEntries(
            Object.entries(full).filter(([k]) => k !== field),
          );
        },
        'SCHEMA_VIOLATION',
        at,
      ],
    ),
    [
      (c) => {
        delete c.quests[QUEST].journal.hints;
        delete c.recipes['quest_sampler@0.0.1:recipe/search_floor'].tip;
        c.manifest.requires.kernel_api.at_least = '1.45';
      },
      'KERNEL_API_RANGE_INVALID',
      floor,
    ],
  ];
  for (const [change, code, path] of rows) {
    const r = load(change);
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [code, path]);
  }
});
