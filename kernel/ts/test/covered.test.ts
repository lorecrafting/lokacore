// R2 (docs/design/story-tooling.md `### R2`): the coverage the R1 child reports and the Story list's
// chips read. Expected values are hand-read from the sampler's own definitions — the dialogue `bram`
// has two choices, `carry` and `leave`, so a path taking `carry` must reach `bram` and leave `leave`
// out. Breaks are named per test.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { compiled } from '../play/compiled.ts';
import { covered } from '../play/covered.ts';
import { ROOT } from '../play/obs.ts';

const tmp = mkdtempSync(join(tmpdir(), 'loka-covered-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

const S = 'scene_sampler@0.0.1:';
const BRAM = `${S}npc/bram`;
const LANTERN = `${S}item/lantern`;
/** Definition refs travel as their strings, as a recording keeps them (place.ts `asRefs`). */
const step = (action_key: string, target_ids: string[] = [], input: unknown = {}) => ({
  intent: { action_key, target_ids, input },
});
// The path the Sampler's own transcript takes: accept lantern, take the lantern, talk to bram, choose
// carry (cartridges/scene_sampler/transcripts/scene.jsonl, ordinals 1-4).
const CARRY = [
  step('lantern'),
  step('take', [LANTERN]),
  step('bram', [BRAM]),
  step('choose', [], { choice_id: 'carry', continuation_id: 'x' }),
];

/** A compiled copy of the sampler with `checkpoints/<name>.json`, which the shipped source lacks. */
const sampler = (name: string, steps: unknown[], edit?: (dir: string) => void) => {
  const dir = join(tmp, name);
  cpSync(join(ROOT, 'cartridges/scene_sampler'), dir, { recursive: true });
  edit?.(dir);
  mkdirSync(join(dir, 'checkpoints'));
  writeFileSync(join(dir, 'checkpoints', `${name}.json`), JSON.stringify({ steps }));
  const bundled = compiled(dir);
  if (typeof bundled === 'string') throw new Error(bundled);
  return { dir, bundled };
};

test('a path taking one choice reaches its dialogue, not its sibling choice, and the reaction on it', () => {
  // Breaks: counting every choice of an opened dialogue, keying a choice without its dialogue, or
  // reading a reaction off an event instead of its narration marker.
  const { dir, bundled } = sampler('one', CARRY, (d) =>
    writeFileSync(
      join(d, 'reactions/on_carry.json'),
      JSON.stringify({
        on: { event: 'choice_resolved', choice: 'carry' },
        steps: [{ op: 'fact.assign', fact: 'bell_heard', value: true }],
      }),
    ),
  );
  // Hand-read from the definitions: bram's choices are carry and leave; `leave`'s sibling practice
  // needs a fact `choose` names, so `leave` is not here. The story point is `lantern_resolved/carry`.
  assert.deepEqual(covered(dir, bundled), {
    [`${S}quest/lantern`]: ['one'],
    [`${S}reaction/on_carry`]: ['one'],
    [`${S}dialogue/bram`]: ['one'],
  });
});

test('two paths reaching one node both name it', () => {
  // Break: keeping only the last path's names, so a chip names one checkpoint of several.
  const { dir, bundled } = sampler('two', CARRY);
  writeFileSync(
    join(dir, 'checkpoints/leave.json'),
    JSON.stringify({
      steps: [
        ...CARRY.slice(0, 3),
        step('choose', [], { choice_id: 'leave', continuation_id: 'x' }),
      ],
    }),
  );
  assert.deepEqual(covered(dir, bundled)[`${S}quest/lantern`], ['leave', 'two']);
});

test('a cartridge with no checkpoints reaches nothing, rather than every node', () => {
  // Break: answering every node when no path exists, so every chip reads covered with no evidence.
  const { bundled } = sampler('none', CARRY);
  assert.deepEqual(covered(join(ROOT, 'cartridges/scene_sampler'), bundled), {});
});

test('a path that stops early still counts the nodes it reached first', () => {
  // Break: discarding a partial replay, so a chip goes blank while its path is being edited; R1's
  // verdict is what says the path broke.
  const { dir, bundled } = sampler('stops', [
    step('lantern'),
    step('move', [], { direction: 'west' }),
  ]);
  assert.deepEqual(covered(dir, bundled), { [`${S}quest/lantern`]: ['stops'] });
});

test("the child's answer carries both R1's verdicts and R2's coverage", () => {
  // Break: printing only the verdicts (no chips) or only the coverage (R1's card goes blank).
  const { dir, bundled } = sampler('both', CARRY);
  const request = join(tmp, 'request.json');
  writeFileSync(request, JSON.stringify({ source: dir, ...bundled }));
  const out = execFileSync(
    process.execPath,
    [join(ROOT, 'kernel/ts/play/check_child.ts'), request],
    {
      cwd: ROOT,
      encoding: 'utf8',
    },
  );
  assert.deepEqual(JSON.parse(out), {
    checked: [{ name: 'both', ok: true }],
    covered: {
      [`${S}quest/lantern`]: ['both'],
      [`${S}dialogue/bram`]: ['both'],
    },
  });
});
