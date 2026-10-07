import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { admitCandidate, applicability } from './e1_policy.ts';
import { reproduce, retainFailure } from './e1_repro.ts';
import { KERNEL, simulate, type Kernel } from './sim.ts';
import { read } from './read.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const bytes = new TextEncoder().encode(
  `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`,
);
const source = {
  source_sha: '1'.repeat(40),
  check_hash: '2'.repeat(64),
  policy_hash: '3'.repeat(64),
};

// Breaks: a slash inside a DefinitionRef map key is mistaken for another object level,
// dropping each definition's root obligation while retaining some of its nested choices.
test('E1 inventory retains slash-bearing v042 definition roots', () => {
  const uses = admitCandidate(bytes).policy.uses;
  for (const [path, feature] of [
    ['/quests/ashmere_missing_child@0.0.42:quest/a_night_in_the_marsh', 'authored.quest'],
    ['/dialogues/ashmere_missing_child@0.0.42:dialogue/a0_d9_aldric_fox', 'authored.dialogue'],
    ['/resources/ashmere_missing_child@0.0.42:resource/hp', 'authored.resource'],
    ['/services/ashmere_missing_child@0.0.42:service/lantern_ale', 'authored.service'],
    ['/transports/ashmere_missing_child@0.0.42:transport/fen_outbound', 'authored.transport'],
    [
      '/recipes/ashmere_missing_child@0.0.42:recipe/begin_epilogue_lost_prior',
      'authored.action_recipe',
    ],
    ['/populations/ashmere_missing_child@0.0.42:population/crow_branches', 'authored.population'],
    ['/bleeds/ashmere_missing_child@0.0.42:bleed/bleeding', 'authored.bleed'],
  ])
    assert.ok(
      uses.some((use) => use.path === path && use.feature === feature),
      path,
    );
});

// Breaks: carry settings inherit scheduling gates and unknown world settings are waived.
test('E1 world settings retain semantic gates and refuse unknown keys', () => {
  const c = structuredClone(pin.value);
  const uses = applicability(c).uses;
  for (const [key, feature, gates] of [
    ['bands', 'resource', ['TRANSACTION']],
    ['bell_cue', 'fact', ['RULES']],
    ['carry', 'containment', ['TRANSACTION']],
    ['combat', 'combat', ['RULES', 'WORLD']],
    ['death', 'death', ['RULES', 'AUTHORITY']],
    ['death_credit', 'combat', ['RULES', 'WORLD']],
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

// Breaks: a simulator/default-corpus green is issued for a valid release other than the
// explicitly frozen chapter. The changed title remains loader-valid.
test('E1 command refuses a different admitted candidate', () => {
  const c = structuredClone(pin.value);
  c.manifest.title = 'Different admitted candidate';
  refused(c, /wrong E1 candidate/);
});

// Breaks: an admitted installed capability is silently skipped when its policy row is
// absent. Narration is installed but has no disposition in the bounded v042 policy.
test('E1 command fails an unknown applicability obligation', () => {
  const c = structuredClone(pin.value);
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
  const outcome = simulate(1, planted, [admitCandidate(bytes)]);
  // The simulator deliberately includes malformed boundary inputs; replay preserves them.
  outcome.commands[0] = { ...outcome.commands[0]!, payload: { type: 'constructor' } as never };
  const record = JSON.parse(JSON.stringify(retainFailure(outcome, source)));
  assert.deepEqual(reproduce(record, bytes, source, planted), {
    id: 'threw',
    detail: 'Error: planted failure',
    at: 0,
  });
  const incomplete = structuredClone(record);
  delete incomplete.fault_schedule;
  assert.throws(() => reproduce(incomplete, bytes, source, planted), /incomplete E1 repro/);
  const changed = { ...record, initial_state_hash: '0'.repeat(64) };
  assert.throws(() => reproduce(changed, bytes, source, planted), /identity mismatch/);
  const changedCommands = structuredClone(record);
  changedCommands.commands[0].payload.type = 'different_boundary_input';
  assert.throws(() => reproduce(changedCommands, bytes, source, planted), /identity mismatch/);
  assert.throws(
    () => reproduce({ ...record, commands: [] }, bytes, source, planted),
    /incomplete E1 repro/,
  );
  assert.throws(() => reproduce(record, bytes, source), /did not reproduce/);
});
