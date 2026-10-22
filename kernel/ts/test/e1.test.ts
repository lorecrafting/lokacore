import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { CHECK_FILES, reportOf } from './e1.ts';
import { admitCandidate, applicability, POLICY_HASH } from './e1_policy.ts';
import { reproduce, retainFailure } from './e1_repro.ts';
import { KERNEL, simulate, type Kernel } from './sim.ts';
import { read } from './read.ts';

const kat = (file: string) => {
  const k = read(`protocol/fixtures/${file}`);
  return {
    value: k.value,
    bytes: new TextEncoder().encode(`{"cartridge":${k.canonical},"content_hash":"${k.sha256}"}`),
  };
};
const candidate = kat('cartridge_bell_hash.json');
const source = {
  source_sha: '1'.repeat(40),
  check_hash: '2'.repeat(64),
  policy_hash: '3'.repeat(64),
};

// Breaks: a slash inside a DefinitionRef map key is mistaken for another object level,
// dropping each definition's root obligation while retaining some of its nested choices.
test('E1 inventory retains slash-bearing definition roots', () => {
  const uses = admitCandidate(candidate.bytes).policy.uses;
  for (const [path, feature] of [
    ['/recipes/recipe_sampler@0.0.1:recipe/ring_bell', 'authored.action_recipe'],
    ['/recipes/recipe_sampler@0.0.1:recipe/ring_bell/outcomes/success', 'authored.action_recipe'],
    ['/resources/recipe_sampler@0.0.1:resource/hp', 'authored.resource'],
  ])
    assert.ok(
      uses.some((use) => use.path === path && use.feature === feature),
      path,
    );
});

// Breaks: carry settings inherit scheduling gates and unknown world settings are waived.
test('E1 world settings retain semantic gates and refuse unknown keys', () => {
  // The candidate authors no world settings; each key is classified by key under its locked owner.
  const c = structuredClone(candidate.value);
  for (const owner of ['containment', 'combat', 'death', 'water']) c.lock.capabilities[owner] = 1;
  c.world = Object.fromEntries(
    ['bands', 'bell_cue', 'carry', 'combat', 'death_credit', 'death', 'movement', 'water'].map(
      (k) => [k, {}],
    ),
  );
  const uses = applicability(c).uses;
  for (const [key, feature, gates] of [
    ['bands', 'resource', ['TRANSACTION']],
    ['bell_cue', 'fact', ['RULES']],
    ['carry', 'containment', ['TRANSACTION']],
    ['combat', 'combat', ['RULES', 'WORLD']],
    ['death_credit', 'combat', ['RULES', 'WORLD']],
    ['death', 'death', ['RULES', 'AUTHORITY']],
    ['movement', 'movement', ['TOPOLOGY']],
    ['water', 'water', ['RULES', 'WORLD']],
  ] as const) {
    const use = uses.find((u) => u.path === `/world/${key}`);
    assert.equal(use?.feature, `authored.${feature}`);
    assert.deepEqual(use?.gates, gates);
  }
  c.world.unowned = {};
  assert.throws(() => applicability(c), /unknown applicability: world.unowned/);
});

// Build changed controlled inputs with Node hashing and separately sorted JSON; the expected
// refusal below is literal and never supplied by the classifier or canonical encoder.
function artifact(c: unknown): string {
  const sorted = (value: any): string =>
    Array.isArray(value)
      ? `[${value.map(sorted).join(',')}]`
      : value && typeof value === 'object'
        ? `{${Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${sorted(value[key])}`)
            .join(',')}}`
        : JSON.stringify(value);
  const canonical = sorted(c);
  return `{"cartridge":${canonical},"content_hash":"${createHash('sha256').update(canonical).digest('hex')}"}`;
}
function refused(c: unknown, expected: RegExp) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-'));
  try {
    const changed = artifact(c);
    assert.throws(() => admitCandidate(new TextEncoder().encode(changed)), expected);
    writeFileSync(join(dir, 'candidate.json'), changed);
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./e1.ts', import.meta.url)),
        join(dir, 'candidate.json'),
        join(dir, 'report'),
        '1',
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, expected);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Breaks: the report's candidate block names a row other than the selected one.
test('E1 admits the literal candidate', () => {
  const admitted = admitCandidate(candidate.bytes);
  assert.equal(admitted.hash, 'ec0d0dfd39aae0f63c8f6fa819d1d288619b546838ade1f0217267063cd40d1d');
  assert.equal(admitted.cartridge.manifest.id, 'recipe_sampler');
  assert.equal(admitted.cartridge.manifest.version, '0.0.1');
  // The report names the selected row, not the chapter.
  const { candidate: report } = reportOf(
    admitted,
    source,
    {} as never,
    admitted.policy,
    [],
    {},
    true,
    false,
  );
  assert.equal(report.id, 'recipe_sampler');
  assert.equal(
    report.content_hash,
    'ec0d0dfd39aae0f63c8f6fa819d1d288619b546838ade1f0217267063cd40d1d',
  );
});

// Breaks: the content hash is not compared against the selected row.
test('E1 command refuses a changed candidate', () => {
  const c = structuredClone(candidate.value);
  c.manifest.title = 'Different admitted candidate';
  refused(c, /wrong E1 candidate/);
});

// Breaks: a loader-valid id with no table row skips the comparison (`row && ...`).
// The ferry fixture passes the loader and applicability, so only the candidate check refuses it.
test('E1 refuses an admitted cartridge with no candidate row', () => {
  const ferry = kat('cartridge_ferry_hash.json');
  assert.throws(() => admitCandidate(ferry.bytes), /wrong E1 candidate: ferry_sampler@0\.0\.1/);
});

// Breaks: the candidate table (or a row field) leaks into the policy digest, so the E1
// coverage receipt no longer names the same policy.
test('E1 policy digest excludes the candidate table', () => {
  assert.equal(POLICY_HASH, '02d71791e4c8f7849ae7e81677685d2ff85f77f343b13d0b31ed358525d725fd');
});

// Breaks: an admitted installed capability is silently skipped when its policy row is
// absent. Narration is installed but has no disposition in the bounded policy.
test('E1 command fails an unknown applicability obligation', () => {
  const c = structuredClone(candidate.value);
  c.lock.capabilities.narration = 1;
  c.manifest.requires.capabilities.narration = 1;
  assert.throws(() => applicability(c), /unknown applicability: narration@1/);
  refused(c, /unknown applicability: narration@1/);
});

// Breaks: replay accepts a seed-only, changed-state or truncated record as reproduction,
// or plays commands without asserting that the recorded invariant still fails.
test('retained repro rechecks the invariant and refuses incomplete or changed inputs', () => {
  const planted: Kernel = {
    ...KERNEL,
    step: () => {
      throw new Error('planted failure');
    },
  };
  const outcome = simulate(1, planted, [admitCandidate(candidate.bytes)]);
  // The simulator deliberately includes malformed boundary inputs; replay preserves them.
  outcome.commands[0] = { ...outcome.commands[0]!, payload: { type: 'constructor' } as never };
  const record = JSON.parse(JSON.stringify(retainFailure(outcome, source)));
  assert.deepEqual(reproduce(record, candidate.bytes, source, planted), {
    id: 'threw',
    detail: 'Error: planted failure',
    at: 0,
  });
  const incomplete = structuredClone(record);
  delete incomplete.fault_schedule;
  assert.throws(
    () => reproduce(incomplete, candidate.bytes, source, planted),
    /incomplete E1 repro/,
  );
  const changed = { ...record, initial_state_hash: '0'.repeat(64) };
  assert.throws(() => reproduce(changed, candidate.bytes, source, planted), /identity mismatch/);
  const changedCommands = structuredClone(record);
  changedCommands.commands[0].payload.type = 'different_boundary_input';
  assert.throws(
    () => reproduce(changedCommands, candidate.bytes, source, planted),
    /identity mismatch/,
  );
  assert.throws(
    () => reproduce({ ...record, commands: [] }, candidate.bytes, source, planted),
    /incomplete E1 repro/,
  );
  assert.throws(() => reproduce(record, candidate.bytes, source), /did not reproduce/);
});

// Breaks: a local module the recorder runs is left out of check_hash, so editing it keeps the receipt.
test('check_hash covers every local module the recorder and its witnesses import', () => {
  const seen = new Set<string>(),
    todo = ['e1.ts', 'e1_obligations.ts'];
  for (let f; (f = todo.pop());)
    if (!seen.has(f)) {
      seen.add(f);
      const text = readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8');
      for (const [, dep] of text.matchAll(/from '\.\/([\w.]+\.ts)'/g)) todo.push(dep!);
    }
  assert.deepEqual(
    [...seen].filter((f) => !CHECK_FILES.includes(f)),
    [],
  );
});
