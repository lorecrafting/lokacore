// `loka play` with an ActionRecipe (R5 S5): the real CLI on the bell known-answer artifact.
// Expected lines are hand-written from the cartridge's text.json (touch links shown as plain
// words) and the terminal's words for each outcome.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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

function play(lines: string[]) {
  const script = join(dir, 'script.txt');
  writeFileSync(script, `${lines.join('\n')}\n`);
  const r = spawnSync('node', [`${ROOT}kernel/ts/play/main.ts`, artifact, script], {
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
