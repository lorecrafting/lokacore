// Toolbox row W24 on the compiled quest_sampler (one real minute is 3000 logical units): find_key
// fails `late` forty minutes after acceptance; reactions/late.json lowers keeper_trust to 0 and
// reactions/word_left.json resolves the quest when recipes/leave_word.json assigns word_left.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';
import { begun } from '../src/mechanics/quest/lifecycle.ts';
import { value } from '../src/mechanics/fact.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';

const MINUTE = 3000;
const scratch = mkdtempSync(join(tmpdir(), 'loka-quest-deadline-'));
let compiled: Obj;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/quest_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
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
function wait(w: World, minutes: number, kind = 'accepted') {
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
  assert.equal(r.decision.kind, kind, JSON.stringify(r.decision));
  const all = r.decision.kind === 'accepted' ? r.decision.events : [];
  return { w: r.world, events: all.map((e) => e.payload), all };
}
const row = (w: World) => Object.values(w.state.quests ?? {})[0]!;
// keeper_trust (facts.json default 2), lowered to 0 by reactions/late.json.
const trust = (w: World) =>
  value(w, w.character, { ...quest, kind: 'fact', key: 'keeper_trust' } as never);
const failedEvents = (events: readonly { type: string }[]) =>
  events.filter((e) => e.type === 'quest_failed');

// Breaks: the job due from started_at (taking the key at five re-stamps it, so it would fail at
// forty-five), no job scheduled, the instance not failed or failed without its outcome, no
// quest_failed event or one the reaction trigger does not match (trust stays 2).
test('a generic deadline fails the open quest at activation plus after, and a reaction penalises', () => {
  let w = wait(play(fresh(), { type: 'accept_quest', quest }), 5).w;
  w = play(w, { type: 'take', item_id: w.entityIds['quest_sampler@0.0.1:item/key'] });
  assert.equal(row(w).state, 'objectives_complete');
  let r = wait(w, 34);
  assert.equal(row(r.w).state, 'objectives_complete');
  assert.deepEqual(failedEvents(r.events), []);
  r = wait(r.w, 1);
  assert.deepEqual([row(r.w).state, row(r.w).outcome], ['failed', 'late']);
  const [failed] = failedEvents(r.events) as unknown as [{ quest: Obj; outcome: string }];
  assert.deepEqual([failed.quest.key, failed.outcome], ['find_key', 'late']);
  assert.equal(trust(r.w), 0);
});

// Breaks: the countdown read from started_at (taking the key re-stamps it: 40 minutes again), from
// a stale job once the quest is resolved, or shown for a legacy deadline (Chapter 1 view bytes).
test('the Journal counts down to the generic deadline job while the quest is open', () => {
  const left = (w: World) => gameView(w).journal[0]!.remaining;
  let w = play(fresh(), { type: 'accept_quest', quest });
  assert.equal(left(w), 40 * MINUTE);
  w = wait(w, 5).w;
  w = play(w, { type: 'take', item_id: w.entityIds['quest_sampler@0.0.1:item/key'] });
  assert.equal(left(w), 35 * MINUTE);
  assert.equal(left(play(w, { type: 'perform', action: 'leave_word' })), undefined);
  // The same pending job under a legacy deadline (it has a fact).
  const def = w.cartridge.quests![QUEST]!;
  const fact = { ...quest, kind: 'fact', key: 'word_left' } as never;
  const legacy = { ...def, deadline: { ...def.deadline!, fact } };
  const quests = { ...w.cartridge.quests, [QUEST]: legacy };
  assert.equal(left({ ...w, cartridge: { ...w.cartridge, quests } } as World), undefined);
});

// Break: a missing or closed instance faults the job (precondition_failed) or fails it anyway.
test('a deadline job of a quest resolved earlier only completes', () => {
  let w = play(fresh(), { type: 'accept_quest', quest });
  w = play(w, { type: 'take', item_id: w.entityIds['quest_sampler@0.0.1:item/key'] });
  w = play(w, { type: 'perform', action: 'leave_word' });
  assert.equal(row(w).state, 'resolved');
  const r = wait(w, 41);
  assert.deepEqual([row(r.w).state, failedEvents(r.events), trust(r.w)], ['resolved', [], 2]);
  assert.deepEqual(
    Object.values(r.w.state.jobs ?? {})
      .filter((j) => j.quest_instance_id)
      .map((j) => j.status),
    ['completed'],
  );
});

// Breaks: a deadline already past at activation faults the accept (nonfuture_job) or never
// expires; quest_failed stamped with the advance target instead of the job's due time.
test('an absolute deadline already past expires on the next advance, at its due time', () => {
  const w = fresh((c) => (c.quests[QUEST].deadline = { at: 0, outcome: 'late' }));
  const accepted = play(wait(w, 1).w, { type: 'accept_quest', quest });
  assert.equal(row(accepted).state, 'active');
  const r = wait(accepted, 1);
  assert.equal(row(r.w).state, 'failed');
  const failed = r.all.filter((e) => e.payload.type === 'quest_failed');
  assert.deepEqual(
    failed.map((e) => e.logical_time),
    [accepted.state.clock + 1],
  );
});

// Break: a job whose instance row is gone faults or fails something instead of only completing.
test('a deadline job whose instance is gone only completes', () => {
  const w = play(fresh(), { type: 'accept_quest', quest });
  const [id, job] = Object.entries(w.state.jobs ?? {}).find(([, j]) => j.quest_instance_id)!;
  const quests = { ...w.state.quests };
  delete quests[job.quest_instance_id!];
  const r = wait({ ...w, state: { ...w.state, quests } } as World, 41);
  assert.deepEqual([r.w.state.jobs?.[id]?.status, failedEvents(r.events)], ['completed', []]);
});

// Break: a job whose instance belongs to another actor fails that instance instead of faulting.
test('a deadline job bound to another actor faults', () => {
  const w = play(fresh(), { type: 'accept_quest', quest });
  const [id, job] = Object.entries(w.state.jobs ?? {}).find(([, j]) => j.quest_instance_id)!;
  const other = '00000000-0000-4000-8000-0000000000ff';
  const forged = {
    ...w,
    state: { ...w.state, jobs: { ...w.state.jobs, [id]: { ...job, actor_id: other } } },
  };
  wait(forged as World, 41, 'fault');
});

// Breaks: the horizon read from the clock alone, so an activation inside an advance schedules a job
// at or before the advance target (nonfuture_job faults the proposal); the due time counted from
// the clock instead of the cause time (a reaction activating at t > clock expires early).
test('a deadline is due at cause time plus after, never inside the proposal advance', () => {
  const advance = { op: 'time.advance', writer_group: 0, from: 0, to: 500 } as const;
  const rows = [
    [1, [advance], 501],
    [100, [], 110],
  ] as const;
  for (const [after, prior, due_time] of rows) {
    const w = fresh((c) => (c.quests[QUEST].deadline = { after, outcome: 'late' }));
    const activate = {
      op: 'quest.activate',
      writer_group: 3,
      quest,
      scope: { kind: 'player', character_id: w.character },
      instance_id: 'q1',
    } as const;
    let k = 0;
    const ops = begun(w, [activate as never], 10, prior, () => `j${k++}`);
    assert.equal(w.state.clock, 0);
    assert.deepEqual(ops[1], {
      op: 'job.schedule',
      writer_group: 3,
      job_id: 'j0',
      job: quest,
      due_time,
      quest_instance_id: 'q1',
      actor_id: w.character,
    });
  }
});

// Breaks (loader twin of test/loka/content_quest_deadline_test.exs): a mixed legacy and generic
// deadline, both or neither of after and at, a legacy one missing a field, or a generic deadline or
// a quest_failed reaction below kernel_api 1.46, loads.
test('the loader refuses a deadline that is neither legacy nor generic, and a generic one below 1.46', () => {
  const at = `.cartridge.quests["${QUEST}"].deadline`;
  const floor = '.cartridge.manifest.requires.kernel_api.at_least';
  const ref = { ...quest, kind: 'fact', key: 'floor_searched' };
  const d = (c: Obj) => c.quests[QUEST].deadline;
  // Below 1.46 with the sampler's other 1.46 features (hints, tip) and one W24 feature removed.
  const below = (c: Obj, without: 'late' | 'deadline') => {
    delete c.quests[QUEST].journal.hints;
    delete c.recipes['quest_sampler@0.0.1:recipe/search_floor'].tip;
    if (without === 'late') delete c.reactions['quest_sampler@0.0.1:reaction/late'];
    else delete c.quests[QUEST].deadline;
    c.manifest.requires.kernel_api.at_least = '1.45';
  };
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
    [(c) => below(c, 'late'), 'KERNEL_API_RANGE_INVALID', floor],
    [(c) => below(c, 'deadline'), 'KERNEL_API_RANGE_INVALID', floor],
  ];
  for (const [change, code, path] of rows) {
    const r = load(change);
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [code, path]);
  }
});
