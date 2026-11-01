// The away cap: an absence catches up at most one capped stretch (docs/system/save.md).
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Key } from '../../../kernel/ts/src/contracts.gen.ts';
import { compiled } from './__tests__/compiled.ts';
import { CatchUpRefusedError } from './elapsed.ts';
import { statusOfError } from './session.ts';
import {
  checkpoint,
  coldReopen,
  elapsedBundle,
  elapsedHost,
  receipts,
} from './__tests__/elapsed-host.test.ts';

const YEAR = 365 * 86_400_000;
const START = 64800; // the fixture calendar's start
const FK =
  'PRAGMA foreign_keys = ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER PRIMARY KEY, parent REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED);';
const settle = (a: ReturnType<typeof elapsedHost>) => {
  let status = a.game.pulse('resume');
  while (status.kind === 'catching_up') status = a.game.pulse('drain');
  return status.kind;
};
function save(t: { after: (f: () => void) => void }) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-away-cap-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, 'save.db');
}

const south = { action_key: 'move' as Key, target_ids: [], input: { direction: 'south' as Key } };

// Breaks: the wall gap is credited whole, so a year away plays a year of world time.
test('a year closed catches up one day on reopen, records the skip, and reopens', (t) => {
  const path = save(t),
    bundle = elapsedBundle();
  const first = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  first.game.pulse();
  first.sql.close();
  const clock = { wall: 10000 + YEAR, mono: 0 };
  const a = elapsedHost(path, clock, bundle);
  assert.equal(settle(a), 'ready');
  assert.equal(a.game.view().view.time, START + 86400);
  assert.deepEqual(checkpoint(a.sql), { wall_ms: clock.wall, remainder: 0, target: START + 86400 });
  const count = receipts(a.sql);
  a.sql.close();
  // A second reopen at the same wall adds nothing: the skip is durable, not owed.
  const b = elapsedHost(path, clock, bundle);
  assert.equal(settle(b), 'ready');
  assert.equal(b.game.view().view.time, START + 86400);
  assert.equal(receipts(b.sql), count);
  b.sql.close();
  coldReopen(path, bundle);
});

// Breaks: the cartridge's cap is ignored; or the milliseconds round up, crediting past the cap at a
// rate that does not divide it (3600 s at rate 7 is 514285 whole ms: 3599.995 s).
test('a cartridge sets its own cap, and a rate that does not divide it rounds down', (t) => {
  const a = elapsedHost(save(t), undefined, elapsedBundle({ away_cap_hours: 1, rate: 7 }));
  a.game.pulse();
  a.clock.wall += YEAR;
  assert.equal(settle(a), 'ready');
  assert.deepEqual(checkpoint(a.sql), {
    wall_ms: 10000 + YEAR,
    remainder: 995,
    target: START + 3599,
  });
  a.sql.close();
});

// Breaks: a failed COMMIT during capped catch-up leaves a save that will not reopen, or the retry
// credits a second cap. A real reopen, after a real failed COMMIT.
test('a failed COMMIT during capped catch-up reopens and credits once', (t) => {
  const path = save(t),
    bundle = elapsedBundle();
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  a.game.pulse();
  a.sql.exec(FK);
  a.clock.wall += YEAR;
  a.fault.kind = 'failed';
  a.fault.armed = true;
  assert.equal(a.game.pulse('resume').kind, 'error');
  a.sql.close();
  const clock = { wall: 10000 + YEAR + 1000, mono: 0 };
  const b = elapsedHost(path, clock, bundle);
  assert.equal(settle(b), 'ready');
  assert.equal(b.game.view().view.time, START + 86400);
  assert.equal(checkpoint(b.sql).target, START + 86400);
  assert.equal(b.sql.prepare('SELECT count(*) n FROM child').get()!.n, 0);
  b.sql.close();
  coldReopen(path, bundle);
});

// Breaks: a COMMIT whose acknowledgement is lost is retried as unsettled, crediting a second cap.
test('a lost acknowledgement of the capped credit never credits it twice', (t) => {
  const path = save(t),
    bundle = elapsedBundle();
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  a.game.pulse();
  a.clock.wall += YEAR;
  a.fault.kind = 'lost';
  a.fault.armed = true;
  assert.equal(a.game.pulse('resume').kind, 'pending');
  a.sql.close();
  const b = elapsedHost(path, { wall: 10000 + YEAR + 1000, mono: 0 }, bundle);
  assert.equal(settle(b), 'ready');
  assert.equal(checkpoint(b.sql).target, START + 86400 + 50); // the 1000 ms since, at rate 50
  b.sql.close();
  coldReopen(path, bundle);
});

// Breaks: a failed COMMIT on a catch-up turn loses the capped debt, or the reopen adds to it.
test('a failed COMMIT on a catch-up turn keeps the capped horizon through a reopen', (t) => {
  const path = save(t),
    bundle = compiled('cartridges/toolbox_showcase');
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  assert.equal(a.game.invoke(south).kind, 'saved');
  a.sql.exec(FK);
  const horizon = Number(checkpoint(a.sql).target) + 86400;
  a.clock.wall += YEAR;
  assert.equal(a.game.pulse('resume').kind, 'catching_up');
  const wall = a.clock.wall;
  a.fault.kind = 'failed';
  a.fault.armed = true;
  assert.equal(a.game.pulse('drain').kind, 'error');
  assert.equal(a.sql.isTransaction, false);
  a.sql.close();
  const b = elapsedHost(path, { wall, mono: 0 }, bundle);
  assert.equal(settle(b), 'ready');
  assert.deepEqual(checkpoint(b.sql), { wall_ms: wall, remainder: 0, target: horizon });
  assert.equal(b.game.view().view.time, horizon);
  b.sql.close();
  coldReopen(path, bundle);
});

// Breaks: a backward clock on reopen rewinds the checkpoint or credits time.
test('a device clock moved backward while closed credits nothing and rebases', (t) => {
  const path = save(t),
    bundle = elapsedBundle();
  const first = elapsedHost(path, { wall: 10000 + YEAR, mono: 0 }, bundle);
  first.game.pulse();
  first.sql.close();
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  assert.equal(settle(a), 'ready');
  assert.deepEqual(checkpoint(a.sql), { wall_ms: 10000, remainder: 0, target: START });
  a.sql.close();
});

// Breaks: each return adds another cap on top of retained debt, so repeated short visits grow the
// catch-up without bound.
test('a return with debt still retained tops it up to one cap, not past it', (t) => {
  const path = save(t),
    bundle = compiled('cartridges/toolbox_showcase');
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  a.game.invoke(south);
  const start = Number(checkpoint(a.sql).target);
  a.clock.wall += YEAR;
  assert.equal(a.game.pulse('resume').kind, 'catching_up');
  const drained = a.game.view().view.time;
  assert.equal(drained, start + 57600); // one drain turn of the 86400 owed
  a.clock.wall += YEAR;
  a.game.pulse('resume');
  assert.equal(checkpoint(a.sql).target, drained + 86400);
  a.sql.close();
});

// Breaks: debt from open play past the cap makes the room for credit negative, so a return lowers the target.
test('a return with more debt than the cap credits nothing and keeps the debt', (t) => {
  const a = elapsedHost(save(t), { wall: 10000, mono: 0 }, compiled('cartridges/toolbox_showcase'));
  a.game.invoke(south);
  const start = Number(checkpoint(a.sql).target);
  a.clock.wall += 5184000;
  a.clock.mono += 5184000; // 72 real minutes of open play at rate 50
  a.game.pulse();
  assert.equal(checkpoint(a.sql).target, start + 259200);
  a.clock.wall += YEAR;
  assert.notEqual(a.game.pulse('resume').kind, 'error');
  assert.equal(checkpoint(a.sql).target, start + 259200);
  a.sql.close();
});

// Breaks: debt converts to ms rounding down, so the credit runs a fraction over what the cap leaves.
// Rate 7: 1 s owed costs 143 ms of the 12342857 ms cap; 12342714 ms * 7 / 1000 credits 86398 s.
test('debt rounds up against the cap at a rate that does not divide a second', (t) => {
  const path = save(t),
    bundle = elapsedBundle({ rate: 7 });
  const first = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  first.game.pulse();
  first.sql.exec('UPDATE elapsed SET target = target + 1');
  first.sql.close();
  const a = elapsedHost(path, { wall: 10000 + YEAR, mono: 0 }, bundle);
  assert.equal(settle(a), 'ready');
  assert.equal(checkpoint(a.sql).target, START + 1 + 86398);
  a.sql.close();
});

// Breaks: a recap save defers its catch-up past open, so a refused delivery arrives on a pulse as a
// plain error with no Start over, where opening would have said save_corrupt.
test('a catch-up refused on a pulse reads as save_corrupt', () => {
  const status = statusOfError(new CatchUpRefusedError('elapsed delivery refused: x'));
  assert.equal(status.kind === 'error' && status.reason, 'save_corrupt');
});
