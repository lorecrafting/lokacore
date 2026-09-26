// `loka play` with doors and brief mode (R5 S7; 00 §4.1; owner decision R5 S4 Q1b): the real CLI
// on the gate known-answer artifact. Expected lines are hand-written from the cartridge's
// text.json (touch links shown as plain words) and the terminal's words for each outcome.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT } from '../play/obs.ts';
import { read } from './read.ts';

const dir = mkdtempSync(join(tmpdir(), 'r5s7-play-'));
const kat = read('protocol/fixtures/cartridge_gate_hash.json');
const artifact = join(dir, 'gate.json');
writeFileSync(artifact, `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`);

// The arrival, then each prompt's reply, without the state and status lines.
function play(lines: string[]) {
  const script = join(dir, 'script.txt');
  writeFileSync(script, `${lines.join('\n')}\n`);
  const r = spawnSync('node', [`${ROOT}kernel/ts/play/main.ts`, artifact, script], {
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout
    .split(/^> /m)
    .map((s) => s.replace(/^(\[state|transcript:|hp \d+\/\d+) .*\n/gm, ''));
}

const GATEHOUSE =
  'Gatehouse\nArrow slits light a draughty stone gatehouse. An oak door leads north to the ' +
  'courtyard; a squat iron-bound door stands to the east.\n';
const COURTYARD =
  'Courtyard\nWeeds push up between the flagstones of a small walled courtyard.\n' +
  'An iron key lies among the weeds.\nExits: south\n';

// Breaks: the long description shown on a revisit in brief mode, or missing on a first visit,
// on look, or with brief mode off.
test('brief mode: a revisited room shows its title and contents; look shows all', () => {
  assert.deepEqual(play(['open north', 'n', 's', 'look', 'n', 'brief', 's', 'brief', 'n']), [
    `${GATEHOUSE}Exits: east (locked), north (closed)\n`,
    'open north\nYou open the oak door.\n',
    `n\n${COURTYARD}`,
    's\nGatehouse\nExits: east (locked), north\n',
    `look\n${GATEHOUSE}Exits: east (locked), north\n`,
    'n\nCourtyard\nAn iron key lies among the weeds.\nExits: south\n',
    'brief\nBrief mode off.\n',
    `s\n${GATEHOUSE}Exits: east (locked), north\n`,
    'brief\nBrief mode on.\n',
    'n\nCourtyard\nAn iron key lies among the weeds.\nExits: south\n',
  ]);
});

// Breaks: a door named by its keywords or direction reaching the wrong exit, an ambiguous name
// building a Command, or a rejection shown with the wrong words.
test('doors are named by direction or keywords, and refusals read as words', () => {
  assert.deepEqual(
    play([
      'n',
      'open door',
      'open gate',
      'open',
      'unlock e',
      'lock north',
      'open oak door',
      'open north',
      'close west',
      'open up',
      'n',
      'take key',
      's',
      'unlock cell door',
      'lock e',
    ]).slice(1),
    [
      'n\nThe way is closed.\n',
      'open door\nWhich do you mean: the cell door or the oak door?\n',
      "open gate\nYou don't see that here.\n",
      'open\nOpen what?\n',
      "unlock e\nYou don't have the key.\n",
      'lock north\nIt has no lock.\n', // review #50 N3: the oak door has no key_item
      'open oak door\nYou open the oak door.\n',
      'open north\nIt is already open.\n',
      'close west\nThere is no exit that way.\n',
      'open up\nThere is no exit that way.\n',
      `n\n${COURTYARD}`,
      'take key\nYou take an iron key.\n',
      's\nGatehouse\nExits: east (locked), north\n',
      'unlock cell door\nYou unlock the cell door.\n',
      'lock e\nYou lock the cell door.\n',
    ],
  );
});

// Breaks: scan showing the room beyond a closed or locked door, missing an item beyond an open
// one, or the empty room's line wrong (00 §4.1 scan).
test('scan shows each door that bars the way, else the room beyond and what is in it', () => {
  assert.deepEqual(play(['scan', 'open north', 'scan', 'n', 'take key', 'scan']).slice(1), [
    'scan\neast: the cell door (locked).\nnorth: the oak door (closed).\n',
    'open north\nYou open the oak door.\n',
    'scan\neast: the cell door (locked).\nnorth (Courtyard): an iron key.\n',
    `n\n${COURTYARD}`,
    'take key\nYou take an iron key.\n',
    'scan\nsouth (Gatehouse).\n',
  ]);
});
