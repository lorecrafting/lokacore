// play/coverage.ts (docs/system/cartridge.md#transcript-coverage-loka-kgd1942) on the scene and
// dusk known answers and their transcripts. Expected values come from the recorded committed
// events: scene.jsonl activates lantern at 1, resolves carry and lantern at 4, changes
// scene_bell_rung at 4-7 and bell_heard (only bell_after writes it) at 7; schedule.jsonl
// completes ring_bell at 2 and pick_lock at 7 (failures at 5 and 6).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { encode } from '../src/foundation/canonical.ts';
import { INSTALLED, loadCartridge, type Cartridge } from '../src/index.ts';
import { coverage, replay } from '../play/coverage.ts';
import { ROOT } from '../play/obs.ts';
import { replayRecords } from '../play/replay.ts';
import { read } from './read.ts';

const S = 'scene_sampler@0.0.1:';
const SCENE = 'cartridges/scene_sampler/transcripts/scene.jsonl';
const DUSK = 'cartridges/check_sampler/transcripts/schedule.jsonl';

const artifact = (fixture: string, edit: (c: any) => void = () => {}) => {
  const c = JSON.parse(read(fixture).canonical);
  edit(c);
  const text = encode(c);
  const h = createHash('sha256').update(text).digest('hex');
  return `{"cartridge":${text},"content_hash":"${h}"}`;
};
const load = (fixture: string, edit?: (c: any) => void) => {
  const loaded = loadCartridge(new TextEncoder().encode(artifact(fixture, edit)), INSTALLED);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return loaded.cartridge as Cartridge;
};
// Each trace with its own pinned hash; `n` keeps the first n entries.
const trace = (path: string, n?: number) => {
  const pin = JSON.parse(readFileSync(ROOT + path, 'utf8').split('\n')[0]!).ids.content_hash;
  const t = replayRecords(ROOT + path, pin);
  return { ...t, entries: t.entries.slice(0, n) };
};

const factRef = (key: string) => ({
  cartridge_id: 'scene_sampler',
  cartridge_version: '0.0.1',
  kind: 'fact',
  key,
});
// Two rules and a dialogue that never fire: the trigger never happens, the `when` never holds
// (carry assigns player_led at 4), the policy never holds (lantern never fails).
const edited = load('protocol/fixtures/cartridge_scene_hash.json', (c) => {
  const { when: _, ...bell } = c.reactions[`${S}reaction/bell_after`];
  c.reactions[`${S}reaction/never_matched`] = {
    ...bell,
    key: 'never_matched',
    on: { event: 'custom_event', custom: 'rope_coiled' },
  };
  const held = { op: 'fact_compare', fact: factRef('search_plan'), equals: 'party_led' };
  c.reactions[`${S}reaction/never_held`] = {
    ...bell,
    key: 'never_held',
    when: held,
  };
  const bram = c.dialogues[`${S}dialogue/bram`];
  const failed = { op: 'quest_state', quest: bram.quest, state: 'failed' };
  c.dialogues[`${S}dialogue/bram_twin`] = {
    ...bram,
    key: 'bram_twin',
    policy: failed,
  };
});
const choice = (dialogue: string, c: string) => ({
  dialogue: `${S}dialogue/${dialogue}`,
  choice: c,
});

test('A, B: a rule whose when failed, a choice keyed without its dialogue, an activated quest', () => {
  // Breaks: trigger counted as fired, choice_id alone, marker on the wrong rule, wrong header hash.
  const authored = JSON.stringify(edited.reactions);
  assert.deepEqual(coverage(edited, [trace(SCENE)]).never, {
    reactions: [`${S}reaction/never_held`, `${S}reaction/never_matched`],
    scripted_actions: [`${S}action/coil_rope`],
    choices: [choice('bram', 'leave'), choice('bram_twin', 'carry'), choice('bram_twin', 'leave')],
    quests: [],
  });
  // Break: quest_activated (ordinal 1) counted as resolved.
  assert.deepEqual(coverage(edited, [trace(SCENE, 3)]).never, {
    reactions: [`${S}reaction/bell_after`, `${S}reaction/never_held`, `${S}reaction/never_matched`],
    scripted_actions: [`${S}action/coil_rope`],
    choices: [
      choice('bram', 'carry'),
      choice('bram', 'leave'),
      choice('bram_twin', 'carry'),
      choice('bram_twin', 'leave'),
    ],
    quests: [`${S}quest/lantern`],
  });
  // Break: upTo ignored (why.ts stops before an ordinal).
  const seen: number[] = [];
  replay(edited, trace(SCENE), (_w, _d, n) => seen.push(n), 4);
  assert.deepEqual(seen, [1, 2, 3]);
  // Break: the marker pushed onto the loaded cartridge's own rules.
  assert.equal(JSON.stringify(edited.reactions), authored);
  // Break: an authored key equal to a marker read as that marker's rule.
  const clash = { ...edited, text: { ...edited.text, 'coverage.m0': 'x' } };
  assert.throws(() => coverage(clash, [trace(SCENE)]), /text key coverage\.m0 collides/);
});

test('C, D: a failed perform counted as completed, a wrong scripted action-to-action mapping', () => {
  const dusk = load('protocol/fixtures/cartridge_dusk_hash.json');
  const none = { reactions: [], choices: [], quests: [] };
  assert.deepEqual(coverage(dusk, [trace(DUSK, 6)]).never, {
    ...none,
    scripted_actions: ['check_sampler@0.0.1:action/pick_lock'],
  });
  assert.deepEqual(coverage(dusk, [trace(DUSK)]).never, { ...none, scripted_actions: [] });
});

test('E: coverage of a stale transcript (the byte guard missing)', () => {
  // equals 1: the rule writes bell_heard at 4, which the recording lacks.
  const stale = load('protocol/fixtures/cartridge_scene_hash.json', (c) => {
    c.reactions[`${S}reaction/bell_after`].when.equals = 1;
  });
  assert.throws(() => coverage(stale, [trace(SCENE)]), /replay differs at ordinal 4/);
  // 64 lines from bell_after (its job runs at 7) push its marker past closing()'s cut; set after the
  // loader, as marked() does, since a reaction narrate needs a newer kernel_api.
  const base = load('protocol/fixtures/cartridge_scene_hash.json');
  const bell = base.reactions![`${S}reaction/bell_after`]!;
  const narrate = { op: 'narrate', text: 'scene.bell' } as any;
  const apply = [...bell.steps, ...Array(64).fill(narrate)];
  const loud = {
    ...base,
    reactions: { ...base.reactions, [`${S}reaction/bell_after`]: { ...bell, steps: apply } },
  };
  assert.throws(() => coverage(loud, [trace(SCENE)]), /narration cap reached at ordinal 7/);
  // The header is compared too: a head whose ids differ from its recorded line 0.
  const t = trace(SCENE);
  const head = {
    ...t.head,
    ids: { ...t.head.ids, kernel_version: `loka-kernel@${'0'.repeat(40)}` },
  };
  assert.throws(() => coverage(edited, [{ ...t, head }]), /replay differs at ordinal 0/);
});

test('F: the CLI wiring', (t) => {
  // A temp file, not /dev/stdin: on Linux runners spawnSync's stdin is a socket (ENXIO).
  const dir = mkdtempSync(join(tmpdir(), 'coverage-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const art = join(dir, 'artifact.json');
  const run = (args: string[], input = artifact('protocol/fixtures/cartridge_scene_hash.json')) => {
    writeFileSync(art, input);
    return spawnSync(process.execPath, [`${ROOT}kernel/ts/play/coverage.ts`, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
    });
  };
  const ok = run([art, SCENE]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(JSON.parse(ok.stdout).never, {
    reactions: [],
    scripted_actions: [`${S}action/coil_rope`],
    choices: [choice('bram', 'leave')],
    quests: [],
  });
  assert.equal(run([art]).stdout, ok.stdout); // the default: the cartridge's own
  const other = run([art, DUSK]);
  assert.equal(other.status, 1);
  assert.match(
    other.stderr,
    /^cartridges\/check_sampler\/transcripts\/schedule\.jsonl: replay differs/,
  );
  const refused = run([art], '{}'); // the loader refuses: its diagnostic, not a crash
  assert.equal(refused.status, 1);
  assert.equal(JSON.parse(refused.stderr).code, 'UNKNOWN_FORMAT');
  assert.equal(run([]).status, 2);
  assert.equal(run(['missing.json']).status, 2);
  // A file that is not a trace is named (pin's own parse error).
  assert.match(
    run([art, 'kernel/ts/play/coverage.ts']).stderr,
    /^kernel\/ts\/play\/coverage\.ts: /,
  );
});
