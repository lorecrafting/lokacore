import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost, witnessedObligations, type CaseHost } from './e1_case_host.ts';
import { replayCase } from './e1_cases.ts';
import { debtElapsed, debtLate } from './e1_debt.ts';
import { hash } from '../src/foundation/canonical.ts';
import type { World } from '../src/index.ts';
import type { Command, DecisionResult, Key } from '../src/contracts.gen.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const bytes = new TextEncoder().encode(
  `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`,
);
const source = {
  source_sha: '1'.repeat(40),
  check_hash: '2'.repeat(64),
  policy_hash: '3'.repeat(64),
};
const peg = '/dialogues/ashmere_missing_child@0.0.42:dialogue/a_peg_debt/choices/';
const aldric = '/dialogues/ashmere_missing_child@0.0.42:dialogue/a_aldric_debt/choices/';
type Step = [World, World, Command, DecisionResult];
const debtPaths = (...step: Step) =>
  witnessedObligations(...step).filter((path) => path.includes('_debt/choices/'));

/** Runs a recorded case; returns each choose step's debt-choice witnesses and the replayed set. */
function run(case_id: string, recipe: (a: CaseHost) => object, plant: (step: Step) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-debt-'));
  const a = caseHost(
    admitCandidate(bytes),
    join(dir, 'save.db'),
    join(dir, 'case.jsonl'),
    undefined,
    {
      case_id,
      source,
      fault_schedule: [],
    },
  );
  try {
    const chosen: string[][] = [];
    a.watch((...step) => {
      if (step[2].payload.type !== 'choose') return;
      chosen.push(debtPaths(...step));
      if (step[3].kind === 'accepted') plant(step);
    });
    const summary = recipe(a);
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    const replay = replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source);
    return {
      summary,
      chosen,
      replayed: replay.obligations.filter((p) => p.includes('_debt/choices/')),
    };
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
}

// Breaks: a late debt choice is credited without its own committed fact transition and receipt event.
test('E1 witnesses late debt choices and their sequence steps only from committed effects', () => {
  const late = [`${aldric}late`, `${aldric}late/sequence/0`, `${aldric}late/sequence/1`];
  const accept = [`${peg}accept_late`, `${peg}accept_late/sequence/0`];
  let planted = 0;
  const result = run('debt-late', debtLate, ([before, after, command, decision]) => {
    if (decision.kind !== 'accepted') return;
    type Fact = Extract<(typeof decision.events)[number]['payload'], { type: 'fact_changed' }>;
    const events = (edit: (p: Fact) => Fact | undefined) => ({
      ...decision,
      events: decision.events.flatMap((e) => {
        if (e.payload.type !== 'fact_changed') return [e];
        const payload = edit(e.payload);
        return payload ? [{ ...e, payload }] : [];
      }),
    });
    const tithe = (edit: (p: Fact) => Fact | undefined) =>
      events((p) => (p.fact.key === 'priory_tithe_delivered' ? edit(p) : p));
    const resolved = { ...before, state: { ...before.state, choices: after.state.choices } };
    const preset = { ...before, state: { ...before.state, facts: after.state.facts } };
    const selected = command.payload.type === 'choose' ? command.payload.choice_id : '';
    const [l, l0, l1] = late;
    const violations: [string, string[], ...Step][] = [
      ['continuation already resolved', [], resolved, after, command, decision],
      ['rejected decision', [], before, after, command, { kind: 'rejected' } as never],
    ];
    if (selected === 'accept_late')
      violations.push([
        'event with wrong prior value',
        [`${peg}accept_late`],
        before,
        after,
        command,
        events((p) => ({ ...p, old: 'late' as Key })),
      ]);
    if (selected === 'late')
      violations.push(
        ['no tithe event', [l, l1], before, after, command, tithe(() => undefined)],
        [
          'tithe event names another fact',
          [l, l1],
          before,
          after,
          command,
          tithe((p) => ({ ...p, fact: { ...p.fact, key: 'peg_trust' } })),
        ],
        [
          'tithe event with another result',
          [l, l1],
          before,
          after,
          command,
          tithe((p) => ({ ...p, new: 'on_time' as Key })),
        ],
        [
          'no axis event',
          [l, l0],
          before,
          after,
          command,
          events((p) => (p.fact.key === 'priory_fen_axis' ? undefined : p)),
        ],
        ['fact not committed', [l], before, before, command, decision],
        [
          'tithe already late',
          [l],
          preset,
          after,
          command,
          tithe((p) => ({ ...p, old: 'late' as Key })),
        ],
      );
    for (const [name, expected, ...step] of violations) {
      assert.deepEqual(debtPaths(...step), expected, name);
      planted++;
    }
  });
  assert.deepEqual(result.summary, { outcome: 'late', axis: -1 });
  assert.deepEqual(result.chosen, [[], accept, [], late]);
  assert.equal(planted, 11);
  assert.deepEqual(result.replayed, [...accept, ...late].sort());
});

// Breaks: Peg's elapsed choice is credited from a refused or already-resolved continuation, or not at all.
test('E1 witnesses the elapsed Peg debt choice only when accepted against its pending continuation', () => {
  let planted = 0;
  const result = run('debt-elapsed', debtElapsed, ([before, after, command, decision]) => {
    const resolved = { ...before, state: { ...before.state, choices: after.state.choices } };
    assert.deepEqual(debtPaths(resolved, after, command, decision), []);
    assert.deepEqual(debtPaths(before, after, command, { kind: 'rejected' } as never), []);
    planted += 2;
  });
  assert.deepEqual(result.summary, { outcome: 'elapsed', quest: null });
  assert.deepEqual(result.chosen, [[], [`${peg}elapsed`]]);
  assert.equal(planted, 2);
  assert.deepEqual(result.replayed, [`${peg}elapsed`]);
});
