// Refusal and friction report (cartridge.md "Refusal and friction report (balance tool 8)";
// kernel/ts/play/friction.ts) on the compiled standing sampler. Expected values are hand-read from
// cartridges/standing_sampler: the player starts in square, whose only exit is east to gate, whose
// only exit is west to square; a move with no exit is refused not_found (mechanics.md); a move
// passes no time; the calendar starts at 25200 with 3600 per hour; the apple lies in square and
// giving it to an NPC (an item_acquired with the NPC as holder, mechanics.md give) adjusts the fact
// trust (reactions/gift_apple.json); taking it does not.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import type { Policy } from '../play/flows.ts';
import { friction, tally } from '../play/friction.ts';
import { INSTALLED, loadCartridge, newWorld, type Cartridge } from '../src/index.ts';
import type { Payload } from './sim.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-friction-'));
after(() => rmSync(scratch, { recursive: true, force: true }));
const file = join(scratch, 'standing.json');
execFileSync('mix', ['loka.compile', 'cartridges/standing_sampler', file], {
  cwd: fileURLToPath(new URL('../../../', import.meta.url)),
  stdio: 'pipe',
});
const loaded = loadCartridge(readFileSync(file), INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const CLI = fileURLToPath(new URL('../play/friction.ts', import.meta.url));

// Four game hours of north, east, west, then a wait to the next hour. Each hour: in square north
// is refused and east accepted; in gate north is refused, east is skipped (played this hour) and
// west accepted; back in square north is refused, east and west skipped, the wait accepted.
const pace: Policy = function pace(w) {
  if (w.state.clock >= 25200 + 4 * 3600) return [];
  const move = (direction: string) => ({ type: 'move', direction });
  return [move('north'), move('east'), move('west'), { type: 'wait', until: w.state.clock + 3600 }];
};

// Breaks: only accepted candidates observed (refused 0), refusals counted by room with accepted
// commands too (square 16, gate 8), or the rate over accepted commands ("100.00"). 6 commands an
// hour, 3 refused: 24 and 12; north refused twice an hour in square, once in gate.
test('a refused north in each room shows by code, room and command', () => {
  const r = friction(content, { seeds: 1, days: 1, policy: pace });
  assert.equal(r.commands, 24);
  assert.equal(r.refused, 12);
  assert.equal(r.per_100, '50.00');
  assert.deepEqual(r.by_code, { not_found: 12 });
  assert.deepEqual(r.by_room, { square: 8, gate: 4 });
  assert.deepEqual(r.by_command, { move: 12 });
  assert.deepEqual(r.drift, { count: 0, first: [] });
});

// Breaks: a backtrack compared to the room the player stands in rather than the one left (0), or
// the start room's first entry not counted. Two moves an hour, 8 in all; every move after the
// first returns to the room the previous one left; square is entered 1 + 4 times, gate 4 times.
test('walking square to gate and back counts every later move as a backtrack', () => {
  const r = friction(content, { seeds: 1, days: 1, policy: pace });
  assert.equal(r.moves, 8);
  assert.equal(r.backtracks, 7);
  assert.deepEqual(r.revisits, { square: 4, gate: 3 });
  assert.deepEqual(r.new_facts, { count: 0, median_steps_between: null });
});

// East, west, take the apple, give it to Maud (trust 0 -> 1), a scan (facts unchanged), then stop.
const fetch = (): Policy => {
  let [i, run]: [number, unknown] = [0, undefined];
  return function fetch(w, _view, _g, visits) {
    if (visits !== run) [i, run] = [0, visits];
    const item_id = w.entityIds['standing_sampler@0.0.1:item/apple'];
    const recipient_id = w.entityIds['standing_sampler@0.0.1:npc/maud'];
    const steps: Payload[] = [
      { type: 'move', direction: 'east' },
      { type: 'move', direction: 'west' },
      { type: 'take', item_id },
      { type: 'give', item_id, recipient_id },
      { type: 'scan' },
    ];
    return steps.slice(i, ++i);
  };
};

// Breaks: a new fact counted on a step that leaves the facts as they were (the scan: 4), or
// the steps between not restarted at the second seed's start (its gap 4 - 4 = 0, median 0).
test('giving the apple is one new fact per seed, four steps from the start', () => {
  const r = friction(content, { seeds: 2, days: 1, policy: fetch() });
  assert.equal(r.commands, 10);
  assert.equal(r.refused, 0);
  assert.deepEqual(r.new_facts, { count: 2, median_steps_between: 4 });
});

// Breaks: drift checked on accepted candidates instead of refused ones. A fresh world's view
// lists square's east exit as available; a refusal invalid_state (a code the view shows on an
// exit) on that move is a disagreement.
test('a refusal of a move the view offers is drift', () => {
  const w = newWorld(content, '1e5f9b6d-4a2c-4d3b-8f8e-7c6b5d4e3f2a' as never, [1, 2, 3, 4]);
  const payload = { actor_id: w.character, type: 'move', direction: 'east' };
  const command = {
    id: 'dddddddd-5555-4333-8444-000000000001',
    world_context_id: w.context,
    payload,
  };
  const decision = { kind: 'rejected', error: { code: 'invalid_state' } };
  const t = tally();
  t.observe(w, { type: 'move', direction: 'east' }, { decision, world: w } as never, {
    command: command as never,
    seed: 1,
    step: 1,
  });
  assert.deepEqual(t.report().drift, {
    count: 1,
    first: [{ seed: 1, step: 1, room: 'square', command: 'move', code: 'invalid_state' }],
  });
});

// Breaks: the CLI printing anything but the canonical report, or accepting a bad flag.
test('the CLI prints the report and refuses a bad flag', () => {
  const ok = spawnSync('node', [CLI, file, '--seeds', '1', '--days', '1'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(typeof JSON.parse(ok.stdout).refused, 'number');
  const bad = spawnSync('node', [CLI, file, '--seeds', '0'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
});
