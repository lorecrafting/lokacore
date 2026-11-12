// roam (docs/design/story-tooling.md §2b W1): a random player over the real authority reports what no
// run reached, and a run that breaks writes a checkpoint `bin/loka check` then guards.
// scene_sampler keeps the arithmetic hand-checkable: two reactions (one behind a take, one behind a
// dialogue answer only available while the lantern is held), one quest, two scenes.
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { roam, verdictOf, writeBreaks } from '../play/roam.ts';
import { compiled } from '../play/compiled.ts';
import { replayed } from '../play/checkpoints.ts';

const root = resolve(import.meta.dirname, '../../..');
const dir = mkdtempSync(join(tmpdir(), 'loka-roam-'));
after(() => rmSync(dir, { recursive: true, force: true }));
const src = join(dir, 'src');
cpSync(join(root, 'cartridges/scene_sampler'), src, { recursive: true });

test('random play of this cartridge reaches everything, so nothing is reported never', () => {
  // 40 runs: `carry` and `leave` are an even split at the dialogue, and only `carry` runs the scene.
  const report = roam(src, { runs: 40, steps: 40, seed: 3 });
  assert.deepEqual(report.broke, [], 'a random player of a valid cartridge breaks nothing');
  assert.deepEqual(report.never.reactions, [], 'both reactions are reachable');
  assert.deepEqual(report.never.quests, [], 'the quest is activated and resolved');
  assert.deepEqual(report.never.scenes, [], 'both scenes run');
  assert.deepEqual(report.never.choices, [], 'the held-lantern answer is reached');
  // Every kind is tallied, and a tally only counts what was reached: a report that lists a ref as
  // never reached and also gives it a hit count contradicts itself.
  assert.ok(Object.keys(report.reached.choices).length > 0, 'reached choices are tallied');
  for (const missed of report.never.choices)
    assert.equal(report.reached.choices[missed], undefined, `${missed} is never reached`);
  for (const counts of Object.values(report.reached))
    assert.ok(
      Object.values(counts).every((n) => n > 0),
      'a hit count is positive',
    );
});

test('a reaction no step can reach is reported by name, not passed over', () => {
  // `search_plan` changes only when Bram's dialogue resolves, and `bell_heard` only becomes true when
  // the scene that resolution starts has ended — so this rule can never fire.
  writeFileSync(
    join(src, 'reactions/unreachable.json'),
    JSON.stringify({
      on: { event: 'fact_changed', fact: 'search_plan' },
      when: { op: 'fact_compare', fact: 'bell_heard', equals: true },
      steps: [{ op: 'fact.assign', fact: 'bell_heard', value: true }],
    }),
  );
  const report = roam(src, { runs: 40, steps: 40, seed: 3 });
  assert.ok(
    report.never.reactions.map((r) => r.split('/').pop()).includes('unreachable'),
    'the unreachable rule is named',
  );
});

test('a fault ends the run, a refusal does not, and both differ from an accepted press', () => {
  // The break path is what turns a found bug into a checkpoint; reading a fault as a refusal would
  // drop it silently, and reading a refusal as a fault would write a checkpoint for ordinary play.
  assert.equal(verdictOf({ kind: 'saved', decision: { kind: 'accepted' } }), 'press');
  assert.equal(verdictOf({ kind: 'saved', decision: { kind: 'rejected' } }), 'skip');
  assert.equal(verdictOf({ kind: 'saved', decision: { kind: 'fault' } }), 'break');
  assert.equal(verdictOf({ kind: 'pending' }), 'skip');
});

test('a break of a seed an author already checkpointed does not overwrite that file', () => {
  // The author may keep a checkpoint of the same seed on purpose; roam must leave it alone.
  const report = roam(src, { runs: 1, steps: 20, seed: 7 });
  mkdirSync(join(src, 'checkpoints'), { recursive: true });
  const authored = join(src, 'checkpoints', 'roam-4242.json');
  writeFileSync(authored, JSON.stringify({ steps: [{ note: 'authored' }] }));
  const breaking = {
    seed: 4242,
    at: 3,
    why: 'fault state_corrupt',
    steps: report.runsWalked[0]!.steps,
  };
  assert.deepEqual(writeBreaks(src, { ...report, broke: [breaking] }), [], 'nothing is written');
  assert.match(readFileSync(authored, 'utf8'), /authored/, 'the author file is untouched');
});

test('a choice gated on a fact random play never sets is reported under never.choices', () => {
  // The spec's sensitivity case, as a content change and not a kernel fault: adding a choice behind a
  // fact the walk cannot set is a real authoring mistake, and the report must name the ref.
  const bram = JSON.parse(readFileSync(join(src, 'dialogues', 'bram.json'), 'utf8')) as {
    choices: Record<string, unknown>;
  };
  bram.choices.gated = {
    label: 'dialogue.bram.carry',
    narration: 'narration.bram.carry',
    policy: { op: 'fact_compare', fact: 'bell_heard', equals: true },
  };
  writeFileSync(join(src, 'dialogues', 'bram.json'), JSON.stringify(bram));
  const report = roam(src, { runs: 3, steps: 20, seed: 1 });
  assert.ok(
    report.never.choices.some((c) => c.endsWith('dialogue/bram#gated')),
    'a choice no press reaches is named by its ref, not passed over',
  );
});

test('a report names the cartridge, run count and seed it measured', () => {
  const report = roam(src, { runs: 2, steps: 15, seed: 11 });
  assert.match(report.cartridge, /^scene_sampler@/);
  assert.equal(report.runs, 2);
  assert.equal(report.seed, 11);
});

test('the steps a run records replay through the same check `bin/loka check` uses', () => {
  // A written checkpoint is only worth writing if its steps are the shape replay reads: this is the
  // property the break path depends on, and it fails if a run records anything replay cannot follow.
  const report = roam(src, { runs: 1, steps: 30, seed: 7 });
  const raw = compiled(resolve(src));
  if (typeof raw === 'string') assert.fail(raw);
  const bundled = { canonical: raw.canonical, sha256: raw.sha256 };
  assert.equal(
    replayed(bundled, report.runsWalked[0]!.steps),
    undefined,
    'the recorded path is accepted',
  );
});
