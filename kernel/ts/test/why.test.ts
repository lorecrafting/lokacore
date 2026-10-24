// play/why.ts (docs/system/cartridge.md#rule-explainer-loka-kgd1943) on the scene known answer and
// scene.jsonl. Expected values come from the recorded committed events (scene_bell_rung changes at
// 4-7 as 1, 2, 3, then -1 when the 3-line scene ends at 7, docs/system/mechanics.md:556; bell_heard
// changes at 7 only; lantern activates at 1, is taken at 2, resolves at 4) and from reaction@1's
// rule-key order: each rule's `when` reads the writes before it (mechanics.md reaction@1).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { encode } from '../src/foundation/canonical.ts';
import { INSTALLED, loadCartridge, type Cartridge } from '../src/index.ts';
import { ROOT } from '../play/obs.ts';
import { replayRecords } from '../play/replay.ts';
import { why } from '../play/why.ts';
import { read } from './read.ts';

const S = 'scene_sampler@0.0.1:';
const BELL = `${S}reaction/bell_after`;
const SCENE = 'cartridges/scene_sampler/transcripts/scene.jsonl';
const FIXTURE = 'protocol/fixtures/cartridge_scene_hash.json';
const ref = (kind: string, key: string) => ({
  cartridge_id: 'scene_sampler',
  cartridge_version: '0.0.1',
  kind,
  key,
});
const rung = (equals: unknown) => ({
  op: 'fact_compare',
  fact: ref('fact', 'scene_bell_rung'),
  equals,
});

const artifact = (edit: (c: any) => void = () => {}) => {
  const c = JSON.parse(read(FIXTURE).canonical);
  edit(c);
  const text = encode(c);
  const h = createHash('sha256').update(text).digest('hex');
  return `{"cartridge":${text},"content_hash":"${h}"}`;
};
const load = (edit?: (c: any) => void) => {
  const loaded = loadCartridge(new TextEncoder().encode(artifact(edit)), INSTALLED);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return loaded.cartridge as Cartridge;
};
const pin = JSON.parse(readFileSync(ROOT + SCENE, 'utf8').split('\n')[0]!).ids.content_hash;
const trace = replayRecords(ROOT + SCENE, pin);
const row = (c: Cartridge, n: number, rule = BELL) => {
  const { reactions } = why(c, trace, n);
  return JSON.parse(JSON.stringify(reactions.find((x) => x.rule === rule))); // loader objects have no prototype
};
const W1 = {
  rule: BELL,
  causes: [
    { event: 'fact_changed', position: 1, filters: { fact: true } },
    { event: 'fact_changed', position: 3, filters: { fact: false } },
  ],
  fired: 1,
  when: { ...rung(-1), held: 1 },
};

// Breaks: a `when` read on the world before the step (3 there, so held 0), a filter read from the
// wrong field, and `fired` taken from the trigger match (W2: matched at 5 while the value is 2).
test('W1, W2: causes, fired and the leaf at the kernel evaluation point', () => {
  const c = load();
  assert.deepEqual(row(c, 7), W1);
  assert.deepEqual(row(c, 5), {
    rule: BELL,
    causes: [{ event: 'fact_changed', position: 1, filters: { fact: true } }],
    fired: 0,
    when: { ...rung(-1), held: 0 },
  });
  const { ordinal, command, outcome } = why(c, trace, 7);
  assert.deepEqual(
    { ordinal, command, outcome },
    { ordinal: 7, command: 'continue', outcome: 'ended' },
  ); // as recorded
});

// Breaks: the tool compares step N itself (the broken guard writes nothing at 7: throws); a
// guard's leaves not reported one by one (the quest resolved at 4, so `quest_state active` fails);
// a leaf read after the step, or by a probe keyed after every rule (a_heard sorts before
// bell_after, so it reads bell_heard before bell_after writes it at 7).
test('W3, W4: a broken guard names its failing leaf; rule-key order holds', () => {
  const quest = { op: 'quest_state', quest: ref('quest', 'lantern'), state: 'active' };
  const broken = load((c) => {
    c.reactions[BELL].when.root = {
      op: 'all',
      items: [rung(-1), quest, { op: 'not', item: quest }],
    };
  });
  const w3 = row(broken, 7);
  assert.equal(w3.fired, 0);
  assert.deepEqual(
    (w3.when as any).items.map((x: any) => (x.item ?? x).held),
    [1, 0, 0], // under `not`, the leaf's own value
  );
  const heard = load((c) => {
    const { when: _, ...bell } = c.reactions[BELL];
    c.reactions[`${S}reaction/never`] = {
      ...bell,
      key: 'never',
      on: { event: 'custom_event', custom: 'rope_coiled' },
    };
    c.reactions[`${S}reaction/a_heard`] = {
      ...c.reactions[BELL],
      key: 'a_heard',
      when: {
        policy_version: 1,
        root: { op: 'fact_compare', fact: ref('fact', 'bell_heard'), equals: true },
      },
    };
  });
  const a = row(heard, 7, `${S}reaction/a_heard`);
  assert.equal(a.fired, 0);
  assert.equal((a.when as any).held, 0);
  assert.equal(row(heard, 7).fired, 1);
  // A rule with no `when` whose event never happens.
  assert.deepEqual(row(heard, 7, `${S}reaction/never`), {
    rule: `${S}reaction/never`,
    causes: [],
    fired: 0,
  });
});

// Break: an on-demand policy read on the world after the step (at 1 the quest is active after
// accept_quest; at 2 the lantern is held after take).
test('W5, W6: dialogue and recipe policies read on the world before the step', () => {
  const c = load((c) => {
    c.recipes[`${S}recipe/coil_rope`].policy.root = {
      op: 'has_item',
      item: ref('item', 'lantern'),
    };
  });
  const dialogue = (n: number) => why(c, trace, n, { dialogue: 'bram' }).dialogue as any;
  assert.equal(dialogue(1).rule, `${S}dialogue/bram`);
  assert.deepEqual([dialogue(1).policy.holds, dialogue(3).policy.holds], [false, true]);
  const recipe = (n: number) => (why(c, trace, n, { recipe: 'coil_rope' }).recipe as any).policy;
  assert.deepEqual([recipe(2).holds, recipe(3).holds], [false, true]);
});

// Break: the prefix guard removed (at 4 the edited rule writes bell_heard; the recording has none).
test('W7: a prefix that no longer replays throws', () => {
  const c = load((c) => {
    c.reactions[BELL].when.root.equals = 1;
  });
  assert.throws(() => why(c, trace, 7), /^Error: replay differs at ordinal 4$/);
});

// Break: markers past the kernel's 64-line narration cut read as rules that did not run.
test('W10: a step at the narration cap throws', () => {
  const base = load(); // set after the loader, as marked() does: a reaction narrate needs a newer kernel_api
  const bell = base.reactions![BELL]!;
  const apply = [...bell.apply, ...Array(64).fill({ op: 'narrate', text: 'scene.bell' })];
  const c = { ...base, reactions: { ...base.reactions, [BELL]: { ...bell, apply } } } as Cartridge;
  assert.throws(() => why(c, trace, 7), /^Error: narration cap reached at ordinal 7$/);
});

// Break: a refused step read as accepted (no events or outcome: crash, or a wrong outcome). With
// bram's policy unmet at 3, talk finds no dialogue (dialogue/selection.ts:93); 3 is not compared.
test('W9: a refused step has no causes and its decision kind', () => {
  const c = load((c) => {
    c.dialogues[`${S}dialogue/bram`].policy.root.state = 'resolved';
  });
  const { outcome, reactions } = why(c, trace, 3);
  assert.deepEqual([outcome, reactions[0]!.causes, reactions[0]!.fired], ['rejected', [], 0]);
});

// Break: CLI wiring (exit 2 arguments, exit 1 a replay that differs, named repo-relative).
test('W8: the CLI prints the explanation and refuses bad arguments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'why-'));
  try {
    const file = join(dir, 'artifact.json');
    writeFileSync(file, artifact());
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [ROOT + 'kernel/ts/play/why.ts', file, ROOT + SCENE, ...args], {
        encoding: 'utf8',
      });
    const ok = run('7');
    assert.equal(ok.status, 0, ok.stderr);
    assert.deepEqual(
      JSON.parse(ok.stdout).reactions.find((x: { rule: string }) => x.rule === BELL),
      W1,
    );
    for (const args of [
      ['0'],
      ['1.5'],
      ['8'],
      ['7', '--recipe', 'nope'],
      ['7', '--recipe', 'coil_rope', '--dialogue', 'bram'],
      ['7', '--other', 'x'],
      [],
    ])
      assert.equal(run(...args).status, 2, args.join(' '));
    assert.equal(run('7', '--recipe', 'nope').stderr, 'no definition keyed nope\n'); // no path: not the transcript's
    writeFileSync(
      file,
      artifact((c) => (c.reactions[BELL].when.root.equals = 1)),
    );
    const differs = run('7');
    assert.deepEqual(
      [differs.status, differs.stderr],
      [1, `${SCENE}: replay differs at ordinal 4\n`],
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});
