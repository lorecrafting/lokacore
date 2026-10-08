// Run: e1_cases.ts artifact.json new-output-dir; replay: add a retained case.jsonl.
// Exit 0 pass (all cases pass, nothing pending), 2 pending, 1 failure; replay success exits 0.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { encode, hash } from '../src/foundation/canonical.ts';
import { newWorld, type World } from '../src/index.ts';
import type { Command, WorldContextId } from '../src/contracts.gen.ts';
import { source, host, redact } from './e1.ts';
import { admitCandidate, applicability, sha256 } from './e1_policy.ts';
import {
  AUTHORITY_KERNEL,
  CASE_GENERATOR,
  caseHost,
  coverage,
  witnessedObligations,
  type CaseHost,
  type LoadedCandidate,
  type Coverage,
} from './e1_case_host.ts';
import { checked } from './sim.ts';
import { ENDINGS, feyAncestry } from './e1_paths.ts';
import { epilogueTalks } from './e1_epilogue_talks.ts';
import { chandlersDebt, lanternDream } from './e1_optional_quests.ts';
import { watchRounds } from './e1_watch_rounds.ts';
import { wispWard, infirmaryHerbs } from './e1_wisp_herbs.ts';
import { maudsCellar } from './e1_maud.ts';
import { debtElapsed, debtLate } from './e1_debt.ts';
import { lanternServices } from './e1_services.ts';
import { creatures } from './e1_creatures.ts';
import { nightMarsh } from './e1_night_marsh.ts';
import { dialogueCircuit } from './e1_dialogue_circuit.ts';
import { elspethStays, rejoin } from './e1_rejoin.ts';
import { read } from './read.ts';
import { topology } from './e1_routes.ts';
import { thirtyDays } from './e1_world.ts';
import { itemRound } from './e1_items.ts';
import { carryLimit } from './e1_world_witness.ts';
import { storageFault, FAULTS, faultSchedule } from './e1_faults.ts';
import { REFUSALS } from './e1_refusals.ts';

// Reviewed {path, reason, evidence, review} rows: e1-certification.md#e1-policy-branch-evidence.
// An optional `refusal` binds the row to a controlled case whose final replayed step is refused with `code`.
type Disposition = {
  path: string;
  reason: string;
  evidence: string;
  review: string;
  refusal?: { case: string; code: string };
};
const DISPOSITIONS: Disposition[] = read('kernel/ts/test/e1_dispositions.json');

// Every recorded case in run order: [case id, recipe, fault schedule]; replay admits only these ids.
const CASES: (readonly [string, (a: CaseHost, path: string) => object | void, object[]?])[] = [
  ...ENDINGS.map(
    ([child, allegiance, fox]) =>
      [
        `${child}-${allegiance}`,
        (a: CaseHost) => epilogueTalks(a, child, allegiance, fox),
      ] as const,
  ),
  ['topology', topology],
  ['dialogue-circuit', dialogueCircuit],
  ['ancestry-fey', feyAncestry],
  ['watch-rounds', watchRounds],
  ['wisp-ward', wispWard],
  ['infirmary-herbs', infirmaryHerbs],
  ['mauds-cellar', maudsCellar],
  ['lantern-services', lanternServices],
  ['creatures', creatures],
  ['item-round', itemRound],
  ['night-marsh', nightMarsh],
  ['rejoin', rejoin],
  ['elspeth-stays', elspethStays],
  ['carry-limit', carryLimit],
  ['debt-on_time', chandlersDebt],
  ['debt-late', debtLate],
  ['debt-elapsed', debtElapsed],
  ...(['follow_fox', 'wake'] as const).map(
    (branch) => [`dream-${branch}`, (a: CaseHost) => lanternDream(a, branch)] as const,
  ),
  ...REFUSALS,
  ['thirty-days', thirtyDays],
  ...FAULTS.map(
    (fault) =>
      [
        `sqlite-${fault}`,
        (a: CaseHost, path: string) => storageFault(a, path, fault),
        faultSchedule(fault),
      ] as const,
  ),
];

export function replayCase(bytes: Uint8Array, text: string, identity: ReturnType<typeof source>) {
  const loaded = admitCandidate(bytes),
    events = text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  const start = events.shift(),
    finish = events.pop();
  assert.equal(start?.kind, 'start', 'incomplete case start');
  assert.equal(start.generator, CASE_GENERATOR);
  assert.equal(finish?.kind, 'finish', 'incomplete case finish');
  assert.deepEqual(start.source, identity, 'case belongs to another source/check/policy');
  assert.equal(start.content_hash, loaded.hash);
  assert.equal(start.artifact_sha256, sha256(bytes));
  assert.equal(start.construction, 'fresh');
  assert.deepEqual(start.host_clock, { wall: 10000, mono: 0 });
  assert.equal(start.rng.algorithm, 'xoshiro128**');
  assert.equal(start.identity.algorithm, 'loka-id-v1');
  const known = CASES.find(([name]) => name === start.case_id);
  assert.ok(known, 'unknown E1 case');
  assert.deepEqual(start.fault_schedule, known[2] ?? [], 'incomplete fault schedule');
  assert.deepEqual(
    start.fault_schedule,
    events.filter((e) => e.kind === 'fault').map(({ kind: _, ...e }) => e),
  );
  let world: World = newWorld(
    loaded.cartridge,
    start.identity.context as WorldContextId,
    start.rng.state,
  );
  assert.equal(hash(world.state as never), start.initial_state_hash);
  assert.equal(encode(world.state as never), encode(start.initial_state));
  assert.equal(world.state.clock, start.logical_clock);
  assert.equal(world.character, start.identity.character);
  assert.equal(world.body, start.identity.body);
  const digest = createHash('sha256');
  let steps = 0,
    final: { code: string; action: string | null } | null = null;
  const obligations = new Set<string>(),
    carry = {};
  for (const e of events) {
    if (e.kind !== 'step') continue;
    const observed = checked(
      AUTHORITY_KERNEL,
      world,
      e.command as Command,
      e.revision,
      e.action_key ?? undefined,
    );
    assert.equal(observed.failure, undefined, JSON.stringify(observed.failure));
    assert.equal(e.invariant_failure, null, 'case recorded an invariant failure');
    assert.equal(observed.bytes, `${encode(e.decision)}\n${e.state_hash}\n`);
    for (const path of witnessedObligations(world, observed.world, e.command, e.decision, carry))
      if (Array.isArray(e.obligations) && e.obligations.includes(path)) obligations.add(path);
    world = observed.world;
    final =
      e.decision.kind === 'rejected'
        ? { code: e.decision.error.code, action: e.action_key ?? null }
        : null;
    assert.equal(world.state.clock, e.clock);
    assert.deepEqual(world.state.rng, e.rng);
    digest.update(observed.bytes);
    steps++;
  }
  assert.equal(steps, finish.steps);
  assert.equal(hash(world.state as never), finish.state_hash);
  assert.equal(digest.digest('hex'), finish.digest, 'incomplete or altered command sequence');
  return {
    case_id: start.case_id,
    steps,
    obligations: [...obligations].sort(),
    state_hash: finish.state_hash,
    fault_schedule: start.fault_schedule,
    final,
  };
}

// Rows are checked before any case runs; a witnessed row fails when gaps() is computed.
export function checkDispositions(loaded: LoadedCandidate, dispositions = DISPOSITIONS) {
  const known = new Set(authoredPaths(loaded));
  assert.equal(
    new Set(dispositions.map((d) => d.path)).size,
    dispositions.length,
    'duplicate disposition',
  );
  for (const d of dispositions)
    assert.ok(
      known.has(d.path) &&
        [d.reason, d.evidence, d.review].every((x) => typeof x === 'string' && x) &&
        (d.refusal === undefined ||
          (REFUSALS.some(([name]) => name === d.refusal?.case) &&
            typeof d.refusal.code === 'string' &&
            d.refusal.code !== '')),
      `invalid disposition ${d.path}`,
    );
}

type Final = ReturnType<typeof replayCase>['final'];
/** Fails unless each `refusal` row's case was recorded and its final replayed step was refused with that code by the row's dialogue (`/dialogues/<ref>/<key>/policy/...`). */
export function checkRefusals(finals: Map<string, Final>, dispositions = DISPOSITIONS) {
  for (const { path, refusal } of dispositions)
    if (refusal)
      assert.deepEqual(
        finals.get(refusal.case),
        { code: refusal.code, action: path.split('/')[3] },
        `refusal ${path}`,
      );
}

const authoredPaths = (loaded: LoadedCandidate) =>
  applicability(loaded.cartridge)
    .uses.filter((u) => u.feature.startsWith('authored.'))
    .map((u) => u.path);

/** The report's three disjoint obligation lists: witnessed, dispositioned and still open. */
export function obligationReport(
  loaded: LoadedCandidate,
  seen: Coverage,
  witnessed: Set<string>,
  dispositions = DISPOSITIONS,
) {
  const { dispositioned_obligations, ...open } = gaps(loaded, seen, witnessed, dispositions);
  return { witnessed_obligations: [...witnessed].sort(), dispositioned_obligations, gaps: open };
}

export function gaps(
  loaded: LoadedCandidate,
  seen: Coverage,
  witnessed: Set<string>,
  dispositions = DISPOSITIONS,
) {
  const c = loaded.cartridge;
  const authored = authoredPaths(loaded);
  const disposed = new Set(dispositions.map((d) => d.path));
  const dialogues = Object.entries(c.dialogues ?? {});
  for (const path of disposed) assert.ok(!witnessed.has(path), `witnessed disposition ${path}`);
  const missing = (expected: string[], actual: Set<string>) =>
    expected.filter((key) => !actual.has(key)).sort();
  return {
    rooms: missing(
      Object.values(c.rooms).map((x) => x.key),
      seen.rooms,
    ),
    quests: missing(
      Object.values(c.quests ?? {}).map((x) => x.key),
      new Set([...seen.quests].map((x) => x.split('/')[0]!)),
    ),
    dialogues: missing(
      dialogues.filter(([ref]) => !disposed.has(`/dialogues/${ref}`)).map(([, x]) => x.key),
      seen.dialogues,
    ),
    choices: missing(
      dialogues.flatMap(([ref, x]) =>
        Object.keys(x.choices)
          .filter((choice) => !disposed.has(`/dialogues/${ref}/choices/${choice}`))
          .map((choice) => `${x.key}/${choice}`),
      ),
      seen.choices,
    ),
    scenes: missing(
      Object.values(c.scenes ?? {}).map((x) => x.key),
      new Set([...seen.scenes].map((x) => x.split('/')[0]!)),
    ),
    authored_obligations: authored.filter((path) => !witnessed.has(path) && !disposed.has(path)),
    dispositioned_obligations: [...disposed].sort(),
  };
}

/** Recorder exit: 1 on failure, 2 while any authored path or family gap is open, else 0. */
export const recorderExit = (failure: string | null, open: Record<string, string[]>) =>
  failure ? 1 : Object.values(open).some((x) => x.length) ? 2 : 0;

function recordCases(bytes: Uint8Array, out: string) {
  const loaded = admitCandidate(bytes);
  // Dispositions and cases are v042's; refuse any other admitted candidate before writing.
  if (loaded.row.id !== 'ashmere_missing_child')
    throw new Error(`E1 recorder records ashmere_missing_child v042 only, not ${loaded.row.id}`);
  const identity = source(),
    machine = host(),
    seen = coverage(),
    witnessed = new Set<string>();
  checkDispositions(loaded);
  assert.equal(existsSync(out), false, 'output directory must be new');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'candidate.json'), bytes, { flag: 'wx' });
  const receipts: object[] = [],
    finals = new Map<string, Final>();
  const run = (name: string, recipe: (typeof CASES)[number][1], fault_schedule: object[] = []) => {
    const path = join(out, `${name}.db`),
      log = join(out, `${name}.jsonl`);
    const a = caseHost(loaded, path, log, `loka-kernel@${identity.source_sha}`, {
      case_id: name,
      source: identity,
      host: machine,
      fault_schedule,
    });
    try {
      const summary = recipe(a, path) ?? null;
      a.record({
        kind: 'finish',
        steps: a.commands.length,
        digest: a.digest(),
        state_hash: hash(a.story.world().state as never),
        summary,
      });
      const replay = replayCase(bytes, readFileSync(log, 'utf8'), identity);
      for (const path of replay.obligations) witnessed.add(path);
      finals.set(name, replay.final);
      for (const key of Object.keys(seen) as (keyof Coverage)[])
        for (const item of a.seen[key]) seen[key].add(item);
      receipts.push({
        case_id: name,
        status: 'pass',
        summary,
        semantic_replay: replay,
        sqlite: `${name}.db`,
        evidence: `${name}.jsonl`,
      });
    } catch (e) {
      a.record({
        kind: 'failure',
        error: redact(String(e)),
        steps: a.commands.length,
        state_hash: hash(a.story.world().state as never),
      });
      throw e;
    } finally {
      a.close();
    }
  };
  let failure: string | null = null;
  try {
    for (const [name, recipe, schedule] of CASES) {
      run(name, recipe, schedule);
      if (name === REFUSALS.at(-1)?.[0]) checkRefusals(finals); // before the cases after them
    }
    assert.deepEqual(source(), identity, 'source changed while recording');
  } catch (e) {
    failure = redact(String(e));
  }
  const obligations = obligationReport(loaded, seen, witnessed),
    exit = recorderExit(failure, obligations.gaps),
    status = failure ? 'fail' : exit ? 'pending' : 'pass';
  const report = {
    status,
    failure,
    certification_verdict: null,
    source: identity,
    host: machine,
    content_hash: loaded.hash,
    artifact_sha256: sha256(bytes),
    receipts,
    coverage: Object.fromEntries(
      Object.entries(seen).map(([key, values]) => [key, [...values].sort()]),
    ),
    ...obligations,
    deferred: [
      'E1 closure: independent review and exact-head CI',
      'release candidate: freeze, selected 10000-sequence proof and gate audit',
      'E2/E3 browser human receipts',
      'native mobile paused',
    ],
  };
  writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  const files = readdirSync(out)
    .filter((f) => !f.endsWith('-journal'))
    .sort();
  writeFileSync(
    join(out, 'SHA256SUMS'),
    files.map((f) => `${sha256(readFileSync(join(out, f)))}  ${f}\n`).join(''),
    { flag: 'wx' },
  );
  process.stdout.write(
    `${status}: ${receipts.length} of ${CASES.length} real SQLite cases passed\n`,
  );
  // Name what failed or is still open, so the log alone shows it.
  if (failure) process.stdout.write(`failure: ${failure}\n`);
  for (const [family, open] of Object.entries(obligations.gaps))
    if (open.length) process.stdout.write(`gap ${family}: ${open.join(' ')}\n`);
  return exit;
}

if (import.meta.main) {
  try {
    const [artifact, output, replay] = process.argv.slice(2);
    if (!artifact || !output)
      throw new Error('usage: e1_cases.ts artifact.json new-output-dir [case.jsonl]');
    const bytes = readFileSync(artifact);
    if (replay) {
      process.stdout.write(
        `${JSON.stringify(replayCase(bytes, readFileSync(replay, 'utf8'), source()))}\n`,
      );
      process.exitCode = 0;
    } else process.exitCode = recordCases(bytes, resolve(output));
  } catch (e) {
    process.stderr.write(`${redact(String(e))}\n`);
    process.exitCode = 1;
  }
}
