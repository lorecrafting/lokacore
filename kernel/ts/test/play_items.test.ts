// `loka play` with items and an NPC (R5 S4): the real CLI on the items known-answer artifact.
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

const dir = mkdtempSync(join(tmpdir(), 'r5s4-play-'));
const kat = read('protocol/fixtures/cartridge_items_hash.json');
const artifact = join(dir, 'items.json');
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

// Breaks: a verb mapped to the wrong command or words, room lines or plain words missing,
// inventory not derived from containment, or a rejection shown with the wrong words.
test('take, drop, give, inventory and examine read as a player expects', () => {
  const out = play([
    'look',
    'get satchel',
    'take satchel',
    'inventory',
    'n',
    'x lantern',
    'take lantern',
    's',
    'give lantern to ferryman',
    'give satchel to bram',
    'drop satchel',
    'i',
    'drop lantern',
    'give satchel to nobody',
    'take',
  ]);
  assert.deepEqual(out, [
    'look\nFerry Landing\nReeds crowd a slick wooden landing. A mooring post leans into the current.\n' +
      'Bram the ferryman stands here, one boot on the ferry.\nA leather satchel leans against a crate.\n' +
      'Exits: north\n',
    'get satchel\nYou take a leather satchel.\n',
    'take satchel\nYou already have that.\n',
    'inventory\nYou are carrying:\n  a leather satchel\n',
    'n\nVillage Green\nAn old elm shades a patch of trodden grass.\n' +
      'A brass lantern lies in the weeds, dry. The oil you carry would fill it.\nExits: south\n',
    'x lantern\nDented brass, its reservoir dry. It would light a fen path.\n',
    'take lantern\nYou take a brass lantern.\n',
    's\nFerry Landing\nReeds crowd a slick wooden landing. A mooring post leans into the current.\n' +
      'Bram the ferryman stands here, one boot on the ferry.\nExits: north\n',
    'give lantern to ferryman\nYou give a brass lantern to Bram the ferryman.\n',
    "give satchel to bram\nThey can't carry any more.\n",
    'drop satchel\nYou drop a leather satchel.\n',
    'i\nYou are carrying nothing.\n',
    "drop lantern\nYou don't see that here.\n", // Bram holds it: out of reach
    "give satchel to nobody\nYou don't see that here.\n",
    'take\nTake what?\n',
  ]);
});
