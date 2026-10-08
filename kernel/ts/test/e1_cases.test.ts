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
import { ending, search } from './e1_paths.ts';
import { lanternDream } from './e1_optional_quests.ts';
import { hash } from '../src/foundation/canonical.ts';
import { gameView } from '../src/index.ts';

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
    assert.equal(
      witnessedObligations(
        a.story.world(),
        a.story.world(),
        committed.command,
        committed.decision,
      ).includes(path),
      false,
    );
    const replay = replayCase(bytes, text, source);
    assert.equal(replay.obligations.includes(path), true);
    const pending = gaps(loaded, coverage(), new Set(replay.obligations)).authored_obligations;
    assert.equal(pending.includes(path), false);
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

// Breaks: accepted recipe admission leaves its definition or required policy predicates gapped.
test('E1 binds the exact study_tracks recipe and required policy from committed performance', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-recipe-'));
  const a = caseHost(
    admitCandidate(bytes),
    join(dir, 'save.db'),
    join(dir, 'case.jsonl'),
    undefined,
    { case_id: 'rescued-prior', source, fault_schedule: [] },
  );
  const base = '/recipes/ashmere_missing_child@0.0.42:recipe/study_tracks';
  const expected = [
    base,
    `${base}/policy/root`,
    `${base}/policy/root/items/0`,
    `${base}/policy/root/items/1`,
  ];
  try {
    const observed: string[][] = [];
    a.watch((before, after, command, decision) => {
      if (command.payload.type === 'perform' && command.payload.action === 'study_tracks')
        observed.push(witnessedObligations(before, after, command, decision));
    });
    search(a);
    assert.deepEqual(observed, [
      [...expected, `${base}/outcomes/success`, `${base}/outcomes/success/sequence/0`],
    ]);
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    const replay = replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source);
    assert.deepEqual(
      expected.filter((path) => !replay.obligations.includes(path)),
      [],
    );
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});

// Breaks: a bell or epilogue result claims authored consequences without its exact committed effects.
test('E1 binds the two bell assignments and the epilogue event to accepted receipts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-outcomes-'));
  const a = caseHost(admitCandidate(bytes), join(dir, 'save.db'));
  const seen = new Map<string, string[]>();
  try {
    a.watch((before, after, command, decision) => {
      if (command.payload.type === 'perform')
        seen.set(command.payload.action, witnessedObligations(before, after, command, decision));
    });
    ending(a, 'rescued', 'prior', 'stilled');
    const recipe = '/recipes/ashmere_missing_child@0.0.42:recipe/';
    assert.deepEqual(
      [0, 1].map((i) =>
        seen.get('ring_bell')?.includes(`${recipe}ring_bell/outcomes/success/sequence/${i}`),
      ),
      [true, true],
    );
    assert.equal(seen.get('ring_bell')?.includes(`${recipe}ring_bell/outcomes/success`), true);
    // Bell objective any(prior, fox) is judged after Ring sets prior: only items/0 is credited.
    const bell = '/quests/ashmere_missing_child@0.0.42:quest/bell_of_ashmere/objective/policy/root';
    assert.deepEqual(
      seen.get('ring_bell')?.filter((path) => path.startsWith(bell)),
      [bell, `${bell}/items/0`],
    );
    assert.equal(
      seen
        .get('begin_epilogue_rescued_prior')
        ?.includes(`${recipe}begin_epilogue_rescued_prior/outcomes/success/sequence/0`),
      true,
    );
    assert.equal(
      seen
        .get('begin_epilogue_rescued_prior')
        ?.includes(`${recipe}begin_epilogue_rescued_prior/outcomes/success`),
      true,
    );
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
    assert.deepEqual(
      rows
        .filter((r) => r.kind === 'step')
        .at(-1)
        .obligations.filter((p: string) => p.startsWith(base)),
      [base, `${base}/policy/root`],
    );
    a.choose('accept');
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    assert.deepEqual(
      replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source).obligations.filter(
        (p) => p.startsWith(base),
      ),
      [base, `${base}/choices/accept`, `${base}/policy/root`],
    );
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});

// Breaks: an accepted all-policy dialogue is recorded without its required child predicates.
test('E1 binds each required predicate of the selected Elspeth report dialogue', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-policy-'));
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
  const base = '/dialogues/ashmere_missing_child@0.0.42:dialogue/a_elspeth_report';
  const expected = [
    base,
    `${base}/policy/root`,
    `${base}/policy/root/items/0`,
    `${base}/policy/root/items/1`,
  ];
  try {
    const observed: string[][] = [];
    a.watch((before, after, command, decision) => {
      const paths = witnessedObligations(before, after, command, decision);
      if (paths.includes(base)) observed.push(paths.filter((path) => path.startsWith(base)));
    });
    search(a);
    assert.deepEqual(observed, [expected]);
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    const replay = replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source);
    assert.deepEqual(
      expected.filter((path) => !replay.obligations.includes(path)),
      [],
    );
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});

// Breaks: a shown modal beat is credited before Continue, or its final acknowledgement is lost.
test('E1 binds modal scene steps only to accepted acknowledgements', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-modal-'));
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
  const base = '/scenes/ashmere_missing_child@0.0.42:scene/bell_rung';
  const bell: string[][] = [];
  try {
    a.watch((before, after, command, decision) => {
      const was = gameView(before).scene;
      const now = gameView(after).scene;
      if (!was && now?.scene.key === 'bell_rung')
        assert.deepEqual(
          witnessedObligations(before, after, command, decision).filter((path) =>
            path.startsWith('/scenes/'),
          ),
          [],
        );
      if (command.payload.type === 'continue' && was?.scene.key === 'bell_rung')
        bell.push(witnessedObligations(before, after, command, decision));
    });
    ending(a, 'rescued', 'prior', 'stilled');
    assert.deepEqual(bell, [
      [base, `${base}/steps/0`],
      [`${base}/steps/1`],
      [`${base}/steps/2`, `${base}/steps/3`, `${base}/steps/4`],
    ]);
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    assert.deepEqual(
      replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source).obligations.filter(
        (path) => path.startsWith(base),
      ),
      [base, ...Array.from({ length: 5 }, (_, n) => `${base}/steps/${n}`)],
    );
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});

// Breaks: a dream choice or closing acknowledgement leaves its authored beat gapped.
test('E1 binds both selected dream branches and acknowledged scene steps', () => {
  const base = '/scenes/ashmere_missing_child@0.0.42:scene/dream_of_the_fen';
  for (const [branch, index] of [
    ['follow_fox', 0],
    ['wake', 1],
  ] as const) {
    const dir = mkdtempSync(join(tmpdir(), 'loka-e1-dream-'));
    const a = caseHost(
      admitCandidate(bytes),
      join(dir, 'save.db'),
      join(dir, 'case.jsonl'),
      undefined,
      { case_id: `dream-${branch}`, source, fault_schedule: [] },
    );
    try {
      const observed: string[][] = [];
      let restDisplays = 0;
      a.watch((before, after, command, decision) => {
        const p = command.payload;
        if (p.type === 'rest') {
          restDisplays++;
          assert.deepEqual(
            witnessedObligations(before, after, command, decision).filter((path) =>
              path.startsWith(base),
            ),
            [],
          );
        }
        if (
          (p.type === 'continue' && p.scene?.key === 'dream_of_the_fen') ||
          (p.type === 'choose' && p.dream)
        )
          observed.push(
            witnessedObligations(before, after, command, decision).filter((path) =>
              path.startsWith(base),
            ),
          );
      });
      lanternDream(a, branch);
      assert.equal(restDisplays, 1);
      assert.deepEqual(observed, [
        [base, `${base}/steps/0`],
        [`${base}/steps/1`],
        [`${base}/steps/2`],
        [`${base}/steps/3`, `${base}/steps/3/choices/${index}`],
        [`${base}/steps/4`, `${base}/steps/5`, `${base}/steps/6`],
        [],
      ]);
      a.record({
        kind: 'finish',
        steps: a.commands.length,
        digest: a.digest(),
        state_hash: hash(a.story.world().state as never),
      });
      const replay = replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source);
      assert.deepEqual(
        replay.obligations.filter((path) => path.startsWith(base)),
        [
          base,
          ...Array.from({ length: 7 }, (_, n) => `${base}/steps/${n}`),
          `${base}/steps/3/choices/${index}`,
        ].sort(),
      );
    } finally {
      a.close();
      rmSync(dir, { recursive: true });
    }
  }
});
