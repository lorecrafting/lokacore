// Run: e1_cases.ts artifact.json new-output-dir; replay: add a retained case.jsonl.
// Exit 2 always leaves certification pending; replay success exits 0, failures exit 1.
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
  caseHost,
  coverage,
  type LoadedCandidate,
  type Coverage,
} from './e1_case_host.ts';
import { checked } from './sim.ts';
import { ending, ENDINGS } from './e1_paths.ts';
import { thirtyDays } from './e1_world.ts';
import { storageFault, FAULTS, faultSchedule } from './e1_faults.ts';

export function replayCase(bytes: Uint8Array, text: string, identity: ReturnType<typeof source>) {
  const loaded = admitCandidate(bytes),
    events = text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  const start = events.shift(),
    finish = events.pop();
  assert.equal(start?.kind, 'start', 'incomplete case start');
  assert.equal(finish?.kind, 'finish', 'incomplete case finish');
  assert.deepEqual(start.source, identity, 'case belongs to another source/check/policy');
  assert.equal(start.content_hash, loaded.hash);
  assert.equal(start.artifact_sha256, sha256(bytes));
  assert.equal(start.construction, 'fresh');
  assert.equal(start.rng.algorithm, 'xoshiro128**');
  assert.equal(start.identity.algorithm, 'loka-id-v1');
  const fault = FAULTS.find((f) => start.case_id === `sqlite-${f}`);
  assert.ok(
    fault ||
      start.case_id === 'thirty-days' ||
      ENDINGS.some(([child, allegiance]) => start.case_id === `${child}-${allegiance}`),
    'unknown E1 case',
  );
  assert.deepEqual(
    start.fault_schedule,
    fault ? faultSchedule(fault) : [],
    'incomplete fault schedule',
  );
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
  let steps = 0;
  for (const e of events) {
    if (e.kind !== 'step') continue;
    const observed = checked(AUTHORITY_KERNEL, world, e.command as Command, e.revision);
    assert.equal(observed.failure, undefined, JSON.stringify(observed.failure));
    assert.equal(e.invariant_failure, null, 'case recorded an invariant failure');
    assert.equal(observed.bytes, `${encode(e.decision)}\n${e.state_hash}\n`);
    world = observed.world;
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
    state_hash: finish.state_hash,
    fault_schedule: start.fault_schedule,
  };
}

function gaps(loaded: LoadedCandidate, seen: Coverage) {
  const c = loaded.cartridge;
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
      Object.values(c.dialogues ?? {}).map((x) => x.key),
      seen.dialogues,
    ),
    choices: missing(
      Object.values(c.dialogues ?? {}).flatMap((x) =>
        Object.keys(x.choices).map((choice) => `${x.key}/${choice}`),
      ),
      seen.choices,
    ),
    scenes: missing(
      Object.values(c.scenes ?? {}).map((x) => x.key),
      new Set([...seen.scenes].map((x) => x.split('/')[0]!)),
    ),
    // Per-definition command/consequence/beat binding still requires reviewed case mapping.
    authored_obligations: applicability(c)
      .uses.filter((u) => u.feature.startsWith('authored.'))
      .map((u) => u.path),
  };
}

function recordCases(bytes: Uint8Array, out: string) {
  const loaded = admitCandidate(bytes),
    identity = source(),
    machine = host(),
    seen = coverage();
  assert.equal(existsSync(out), false, 'output directory must be new');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'candidate.json'), bytes, { flag: 'wx' });
  const receipts: object[] = [];
  const run = (
    name: string,
    recipe: (a: ReturnType<typeof caseHost>, path: string) => object,
    fault_schedule: object[] = [],
  ) => {
    const path = join(out, `${name}.db`),
      log = join(out, `${name}.jsonl`);
    const a = caseHost(loaded, path, log, `loka-kernel@${identity.source_sha}`, {
      case_id: name,
      source: identity,
      host: machine,
      fault_schedule,
    });
    try {
      const summary = recipe(a, path);
      a.record({
        kind: 'finish',
        steps: a.commands.length,
        digest: a.digest(),
        state_hash: hash(a.story.world().state as never),
        summary,
      });
      const replay = replayCase(bytes, readFileSync(log, 'utf8'), identity);
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
    for (const [child, allegiance, fox] of ENDINGS)
      run(`${child}-${allegiance}`, (a) => ending(a, child, allegiance, fox));
    run('thirty-days', thirtyDays);
    for (const fault of FAULTS)
      run(`sqlite-${fault}`, (a, path) => storageFault(a, path, fault), faultSchedule(fault));
    assert.deepEqual(source(), identity, 'source changed while recording');
  } catch (e) {
    failure = redact(String(e));
  }
  const report = {
    status: failure ? 'fail' : 'pending',
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
    gaps: gaps(loaded, seen),
    pending: [
      'selected 10000-sequence proof on final source/check identity',
      'all applicable path/consequence/beat receipts',
      'independent final candidate review',
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
    `${failure ? 'fail' : 'pending'}: ${receipts.length} real SQLite cases passed; explicit coverage gaps retained\n`,
  );
  return failure ? 1 : 2;
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
