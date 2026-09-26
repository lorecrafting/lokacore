// `loka play` with an ActionRecipe (R5 S5): the real CLI on the bell known-answer artifact.
// Expected lines are hand-written from the cartridge's text.json (touch links shown as plain
// words) and the terminal's words for each outcome.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT } from '../play/obs.ts';
import { read } from './read.ts';

const dir = mkdtempSync(join(tmpdir(), 'r5s5-play-'));
const kat = read('protocol/fixtures/cartridge_bell_hash.json');
const artifact = join(dir, 'bell.json');
writeFileSync(artifact, `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`);

function play(lines: string[], file = artifact) {
  const script = join(dir, 'script.txt');
  writeFileSync(script, `${lines.join('\n')}\n`);
  const r = spawnSync('node', [`${ROOT}kernel/ts/play/main.ts`, file, script], {
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  // Each prompt's reply, without the state lines.
  return r.stdout
    .split(/^> /m)
    .slice(1)
    .map((s) => s.replace(/^(\[state|transcript:) .*\n/gm, ''));
}

// Breaks: a recipe alias not recognized (alone or before target words), the words after it not
// resolved to the target, the narration not shown, the variants not following the rung bell,
// or a rejection shown with the wrong words.
test('ring bell rings once, narrates, and the rooms and bell read differently after', () => {
  const out = play(['ring rope', 'Ring the bell', 'x bell', 'ring', 'd', 'ring bell', 'ring gong']);
  assert.deepEqual(out, [
    "ring rope\nYou can't do that to that.\n",
    'Ring the bell\nYou haul on the rope. The bell swings, and its voice rolls out over the fen.\n',
    'x bell\nGreen bronze, warm now, still humming under your hand.\n',
    "ring\nYou can't do that now.\n",
    "d\nBell Tower\nA narrow stair climbs through the dark. The walls still tremble with the bell's voice.\nExits: up\n",
    "ring bell\nYou don't see that here.\n", // the bell is in the belfry
    "ring gong\nYou don't see that here.\n",
  ]);
});

const sorted = (v: any): any =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sorted(v[k])]),
        )
      : v;

// Astra A2: the bell known answer plus a gong in the bell tower rung by ring_gong and a second
// bell recipe, all with the alias ring. Written twice, the recipes map in either order: the
// content hash is the same, so the answers must be too.
function gongs(): string[] {
  const c = sorted(structuredClone(kat.value));
  const ref = (kind: string, key: string) => ({ ...c.entry, kind, key });
  const bell = c.recipes['ashmere_bell@0.0.1:recipe/ring_bell'];
  const tower = c.rooms['ashmere_bell@0.0.1:room/bell_tower'];
  tower.details = { gong: { aliases: ['gong'], description: 'detail.rope' } };
  const gong = {
    ...bell,
    key: 'ring_gong',
    label: 'actions.ring_gong',
    policy: { policy_version: 1, root: { op: 'all', items: [] } },
  };
  gong.target = { kind: 'detail', room: ref('room', 'bell_tower'), detail: 'gong' };
  const success = {
    ...bell.outcomes.success,
    sequence: [{ op: 'event.emit', event: 'gong_rung' }],
  };
  gong.outcomes = { success }; // leaves the bell unrung
  c.recipes['ashmere_bell@0.0.1:recipe/ring_gong'] = gong;
  c.recipes['ashmere_bell@0.0.1:recipe/toll_bell'] = {
    ...bell,
    key: 'toll_bell',
    label: 'actions.toll_bell',
  };
  c.text['actions.ring_gong'] = 'Ring the gong';
  c.text['actions.toll_bell'] = 'Toll the bell';
  const text = JSON.stringify(sorted(c));
  const h = createHash('sha256').update(text).digest('hex');
  return [
    text,
    JSON.stringify({ ...c, recipes: Object.fromEntries(Object.entries(c.recipes).reverse()) }),
  ].map((t, i) => {
    const file = join(dir, `gongs${i}.json`);
    writeFileSync(file, `{"cartridge":${t},"content_hash":"${h}"}`);
    return file;
  });
}

// Breaks: the first recipe with the alias chosen before the target is resolved (so ring gong
// reaches ring_bell and is refused), the choice depending on the recipes map's order, or two
// recipes that both take the target not asked about.
test('an alias shared by recipes picks the one whose target the words name', () => {
  for (const file of gongs())
    assert.deepEqual(
      play(['d', 'ring gong', 'u', 'ring bell', 'ring rope'], file),
      [
        'd\nBell Tower\nA narrow stair climbs through the dark. Pigeon feathers drift on the steps.\nExits: up\n',
        'ring gong\nYou haul on the rope. The bell swings, and its voice rolls out over the fen.\n',
        'u\nBelfry\nThe great bronze bell hangs still from an oak beam. A frayed rope drops from its wheel.\nExits: down\n',
        'ring bell\nWhich do you mean: Ring the bell or Toll the bell?\n',
        "ring rope\nYou can't do that to that.\n",
      ],
      file,
    );
});

// R5 S6a, the dusk known answer (ring_bell from 18 to 6, a minute long). Breaks: wait not
// adding whole hours to the clock, the clock shown with the wrong day or hour, a wait outside 1
// to 24 hours building a Command, or the dusk gate not following the clock.
test('wait passes whole hours and the bell rings only between dusk and dawn', () => {
  const dusk = read('protocol/fixtures/cartridge_dusk_hash.json');
  const file = join(dir, 'dusk.json');
  writeFileSync(file, `{"cartridge":${dusk.canonical},"content_hash":"${dusk.sha256}"}`);
  assert.deepEqual(
    play(['wait 6', 'ring', 'wait', 'wait 0', 'wait 25', 'wait 11', 'ring', 'wait 24'], file),
    [
      'wait 6\nTime passes. It is day 1, 06:00.\n',
      "ring\nYou can't do that now.\n",
      'wait\nTime passes. It is day 1, 07:00.\n',
      'wait 0\nWait how many hours?\n',
      'wait 25\nWait how many hours?\n',
      'wait 11\nTime passes. It is day 1, 18:00.\n',
      'ring\nYou ring the lych bell. Its thin note carries over the graves.\n',
      'wait 24\nTime passes. It is day 2, 18:01.\n',
    ],
  );
});
