import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost, coverage, witnessedObligations } from './e1_case_host.ts';
import { storageFault, faultSchedule } from './e1_faults.ts';
import { replayCase, gaps } from './e1_cases.ts';
import { search } from './e1_paths.ts';
import { hash } from '../src/foundation/canonical.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const bytes = new TextEncoder().encode(
  `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`,
);
const source = {
  source_sha: '1'.repeat(40),
  check_hash: '2'.repeat(64),
  policy_hash: '3'.repeat(64),
};

// Breaks: a case replay says green after the SQLite fault or an intermediate commit is omitted.
test('E1 SQLite case requires complete fault schedule and committed commands', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-case-')),
    path = join(dir, 'save.db'),
    log = join(dir, 'case.jsonl');
  const a = caseHost(admitCandidate(bytes), path, log, undefined, {
    case_id: 'sqlite-lost',
    source,
    fault_schedule: faultSchedule('lost'),
  });
  try {
    const summary = storageFault(a, path, 'lost');
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
      summary,
    });
    const text = readFileSync(log, 'utf8');
    assert.equal(replayCase(bytes, text, source).steps, 2);
    const rows = text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    rows[0].fault_schedule = [];
    assert.throws(
      () => replayCase(bytes, rows.map((r) => JSON.stringify(r)).join('\n'), source),
      /incomplete fault schedule/,
    );
    assert.throws(() =>
      replayCase(
        bytes,
        text
          .trim()
          .split('\n')
          .filter((line) => JSON.parse(line).kind !== 'step')
          .join('\n'),
        source,
      ),
    );
    assert.throws(
      () => replayCase(bytes, text.trim().split('\n').slice(0, -1).join('\n'), source),
      /incomplete case finish/,
    );
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});

// Breaks: an executed consequence remains gapped, or missing/unrelated/non-transition evidence claims it.
test('E1 binds only the witnessed study_tracks consequence after semantic replay', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-binding-'));
  const loaded = admitCandidate(bytes);
  const a = caseHost(loaded, join(dir, 'save.db'), join(dir, 'case.jsonl'), undefined, {
    case_id: 'rescued-prior',
    source,
    fault_schedule: [],
  });
  const path =
    '/recipes/ashmere_missing_child@0.0.42:recipe/study_tracks/outcomes/success/sequence/0';
  try {
    search(a);
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    const text = readFileSync(join(dir, 'case.jsonl'), 'utf8');
    // A retained accepted receipt cannot witness a new assignment when the fact was already true.
    assert.equal(a.flag('fen_tracks_found'), true);
    const committed = text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
      .find(
        (row) =>
          row.kind === 'step' &&
          row.command.payload.type === 'perform' &&
          row.command.payload.action === 'study_tracks',
      );
    assert.equal(committed.decision.kind, 'accepted');
    assert.deepEqual(
      witnessedObligations(a.story.world(), a.story.world(), committed.command, committed.decision),
      [],
    );
    const replay = replayCase(bytes, text, source);
    assert.equal(replay.obligations.includes(path), true);
    const pending = gaps(loaded, coverage(), new Set(replay.obligations)).authored_obligations;
    assert.equal(pending.includes(path), false);
    assert.equal(
      pending.includes('/recipes/ashmere_missing_child@0.0.42:recipe/study_tracks'),
      true,
    );
    for (const replacement of [undefined, [], ['/world/carry']]) {
      const rows = text
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      for (const row of rows) if (row.kind === 'step') row.obligations = replacement;
      const missing = replayCase(bytes, rows.map((r) => JSON.stringify(r)).join('\n'), source);
      assert.deepEqual(missing.obligations, []);
      assert.equal(
        gaps(loaded, coverage(), new Set(missing.obligations)).authored_obligations.includes(path),
        true,
      );
    }
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});

// Breaks: offering dialogue choices is mistaken for selecting them, or the accepted choice is lost.
test('E1 witnesses an opened dialogue and only its accepted choice', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-dialogue-'));
  const a = caseHost(
    admitCandidate(bytes),
    join(dir, 'save.db'),
    join(dir, 'case.jsonl'),
    undefined,
    {
      case_id: 'rescued-prior',
      source,
      fault_schedule: [],
    },
  );
  const base = '/dialogues/ashmere_missing_child@0.0.42:dialogue/elspeth';
  try {
    a.invoke('choose_ancestry', [], { ancestry: 'fen_born' });
    a.invoke('elspeth', [a.entity('npc', 'elspeth')]);
    const rows = readFileSync(join(dir, 'case.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.deepEqual(rows.filter((r) => r.kind === 'step').at(-1).obligations, [base]);
    a.choose('accept');
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    assert.deepEqual(
      replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source).obligations,
      [base, `${base}/choices/accept`],
    );
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});
