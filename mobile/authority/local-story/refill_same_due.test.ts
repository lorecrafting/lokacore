// A reaction's resource.adjust beside a same-due job, through the real driver and reopen: both job
// orders save, and the death's authored return outlives a refill (mechanics.md, Level-up refill).
// Hp shows the order: a refill to 10 then a loss of 1 ends at 9, the loss then the refill at 10.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  gameView,
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import { openStory } from './authority.ts';
import { coldReopen, elapsedHost } from './__tests__/elapsed-host.test.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'loka-refill-due-'));
test.after(() => rmSync(scratch, { recursive: true, force: true }));
let cases = 0;

type Edit = (dir: string, json: (file: string, change: (o: any) => void) => void) => void;
/** The levelling sampler with source `edit`s, compiled as the Book's bundle. */
function compiled(edit: Edit) {
  const dir = join(scratch, `c${++cases}`);
  cpSync(join(root, 'cartridges/levelling_sampler'), dir, { recursive: true });
  edit(dir, (file, change) => {
    const o = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    change(o);
    writeFileSync(join(dir, file), JSON.stringify(o));
  });
  const out = `${dir}.json`;
  execFileSync('mix', ['loka.compile', dir, out], { cwd: root, stdio: 'pipe' });
  const artifact = JSON.parse(readFileSync(out, 'utf8'));
  const loaded = loadCartridge(new TextEncoder().encode(JSON.stringify(artifact)), INSTALLED);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded));
  const fresh = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  return {
    fresh,
    bundle: { canonical: encode(artifact.cartridge), sha256: artifact.content_hash as string },
  };
}

const hpOf = (w: World) => gameView(w).resources!.find((r) => r.resource.key === 'hp')!.current;

/** Walks `plan` once per invocation id prefix: every step saves, also after a reopen and a cold
 * reopen, one more pulse then saves (a fault here would be for good); the final state of each. */
function everyPrefix(c: ReturnType<typeof compiled>, plan: ('attack' | 'pulse')[]) {
  const finals: { hp: number; level: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const prefix = i.toString(16).repeat(8);
    const path = join(scratch, `s${cases}-${i}.db`);
    const releases = [{ fresh: c.fresh, content_hash: c.bundle.sha256 }] as const;
    let p = elapsedHost(path, undefined, c.bundle);
    const open = () => {
      const s = openStory(p.db, releases, p.host);
      if (s.kind !== 'open') throw new Error(s.kind);
      return s;
    };
    let story = open();
    let n = 0;
    const saved = (r: { kind: string }) =>
      assert.equal(r.kind, 'saved', `prefix ${prefix}: ${JSON.stringify(r)}`);
    const invoke = (action_key: string, target_ids: string[], input: object) =>
      saved(
        story.invoke({
          invocation_id: `${prefix}-8888-4888-8888-${String(++n).padStart(12, '0')}`,
          actor_id: c.fresh.character,
          action_key,
          target_ids,
          input,
        }),
      );
    const pulse = () => {
      const from = story.world().state.clock;
      saved(story.elapsed({ expected_run_id: story.runId(), from, until: from + 150 }));
    };
    invoke('move', [], { direction: 'east' });
    const target =
      c.fresh.entityIds['levelling_sampler@0.0.1:npc/rat_a'] ??
      Object.keys(c.fresh.state.created ?? {})[0]!;
    for (const s of plan) {
      if (s === 'attack') invoke('attack', [target], {});
      else pulse();
    }
    const final = {
      hp: hpOf(story.world()),
      level: gameView(story.world()).levelling?.level ?? 0,
    };
    finals.push(final);
    p.sql.close();
    p = elapsedHost(path, undefined, c.bundle);
    story = open();
    assert.equal(hpOf(story.world()), final.hp, 'reopen');
    pulse();
    p.sql.close();
    coldReopen(path, c.bundle);
  }
  return finals;
}
const hps = (finals: { hp: number }[]) =>
  [...new Set(finals.map((f) => f.hp))].sort((a, b) => a - b);
const fight = (rounds: number): ('attack' | 'pulse')[] => [
  'attack',
  ...Array<'pulse'>(rounds).fill('pulse'),
];

const CAPS = 'cartridge.json';
const LINE = 'levelling.level_up';
const REFILL = { op: 'resource.adjust', resource: 'hp', by: 2147483647 };
const rule = (dir: string, name: string, body: object) =>
  writeFileSync(join(dir, `reactions/${name}.json`), JSON.stringify(body));
/** An hp status from entering the pit, due with every combat round. */
const sore: Edit = (dir, json) => {
  json(CAPS, (o) => (o.requires.capabilities.status = 1));
  mkdirSync(join(dir, 'statuses'));
  writeFileSync(
    join(dir, 'statuses/sore.json'),
    JSON.stringify({
      duration: 36000,
      tick_every: 150,
      resource: 'hp',
      per_tick: -1,
      name: LINE,
      narration: { applied: LINE, tick: LINE, expired: LINE },
    }),
  );
  rule(dir, 'sore', {
    on: { event: 'entity_entered_room', room: 'pit' },
    steps: [{ op: 'status.apply', status: 'sore' }],
  });
};
/** rat_a alone reaches level 2, has `hp`, and bites with `attack`. */
const rat =
  (hp: number, attack: object = { chance: 100 }): Edit =>
  (_, json) => {
    json(CAPS, (o) => {
      o.world.levelling.kills = o.world.levelling.kills.map((k: any) => ({ ...k, experience: 30 }));
    });
    json('npcs/rat_a.json', (o) => {
      Object.assign(o.hp, { maximum: hp, start: hp });
      Object.assign(o.attack, attack);
    });
  };
/** rat_a, a spawned one as bleeds need, whose bite opens a wound due with every later round. */
const wounding: Edit = (dir, json) => {
  json(CAPS, (o) => {
    Object.assign(o.requires.capabilities, { bleed: 1, food: 1, skill: 1, population: 1 });
    o.calendar = JSON.parse(
      readFileSync(join(root, 'cartridges/bleed_sampler/cartridge.json'), 'utf8'),
    ).calendar;
  });
  mkdirSync(join(dir, 'populations'));
  writeFileSync(
    join(dir, 'populations/rats.json'),
    JSON.stringify({
      npc: 'rat_a',
      item: 'fur',
      corpse: 'npc_corpse',
      home: 'pit',
      area: ['pit', 'hall'],
      cap: 1,
      day_target: 1,
      night_target: 1,
      night_start: 20,
      night_end: 6,
      replacement_delay: 86400,
      wander_interval: 3600,
    }),
  );
  mkdirSync(join(dir, 'bleeds'));
  writeFileSync(
    join(dir, 'bleeds/cut.json'),
    JSON.stringify({
      duration: 36000,
      tick_every: 150,
      hp_loss: 1,
      narration: { applied: LINE, refreshed: LINE, tick: LINE, expired: LINE },
    }),
  );
  writeFileSync(
    join(dir, 'items/fur.json'),
    JSON.stringify({
      keywords: ['fur'],
      name: 'item.npc_corpse.short',
      room_line: 'item.npc_corpse.room',
      description: 'item.npc_corpse.description',
      mass_grams: 10,
      location: { in: 'template' },
    }),
  );
  json('npcs/rat_a.json', (o) => {
    o.spawn_template = true;
    o.attack.on_positive_hit = { effect: 'cut' };
  });
};
const edits =
  (...all: Edit[]): Edit =>
  (d, j) =>
    all.forEach((e) => e(d, j));
const onAttack = { on: { event: 'attack_result' }, steps: [REFILL] };
const delayed = (after: number) => ({
  on: { event: 'entity_entered_room', room: 'pit' },
  after,
  steps: [REFILL],
});

// Each row breaks when the refill neither joins the body's holder nor holds the body itself: the
// same-due job takes another group, conflicting_write, and the host resends that due for good.
const ORDERS: [string, Edit, ('attack' | 'pulse')[], number][] = [
  ['a status tick, a kill with no bite (odd round)', edits(sore, rat(4)), fight(1), 2],
  ['a status tick, a kill after a bite (even round)', edits(sore, rat(8)), fight(2), 2],
  ['a bleed tick, a kill after a bite', edits(rat(8), wounding), fight(2), 2],
  ['a bleed tick, a kill with no bite', edits(rat(12), wounding), fight(3), 2],
  [
    'a delayed rule and a bite',
    edits(rat(100), (d) => rule(d, 'later', delayed(300))),
    fight(2),
    1,
  ],
  [
    'a delayed rule and a status tick',
    edits(sore, (d) => rule(d, 'later', delayed(150))),
    ['pulse'],
    1,
  ],
  [
    'an attack_result rule and a status tick',
    edits(sore, rat(100, { chance: 0 }), (d) => rule(d, 'hit', onAttack)),
    fight(1),
    1,
  ],
];
for (const [name, edit, plan, level] of ORDERS)
  test(`${name}: both orders save and reopen`, () => {
    const finals = everyPrefix(compiled(edit), plan);
    assert.deepEqual(hps(finals), [9, 10], JSON.stringify(finals));
    assert.ok(finals.every((f) => f.level === level));
  });

// Breaks: a refill at the moment of a death raises the authored return (ruling: the return wins),
// including one from level_two, whose level_reached lands after the death.
const DEATHS: [string, Edit, number][] = [
  [
    'level_two',
    (d) =>
      rule(d, 'died', {
        on: { event: 'entity_died' },
        steps: [{ op: 'experience.grant', amount: 30 }],
      }),
    2,
  ],
  ['an attack_result rule', (d) => rule(d, 'hit', onAttack), 1],
];
for (const [name, edit, level] of DEATHS)
  test(`${name} in a death round leaves the authored return`, () => {
    const lethal = rat(100, { chance: 100, damage_min: 99, damage_max: 99 });
    const low: Edit = (_, json) => json(CAPS, (o) => (o.world.death.restore.hp = 4));
    const finals = everyPrefix(compiled(edits(lethal, low, edit)), fight(1));
    assert.deepEqual(hps(finals), [4], JSON.stringify(finals));
    assert.ok(finals.every((f) => f.level === level));
  });
