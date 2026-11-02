import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { coldReopen, elapsedBundle, elapsedHost } from './__tests__/elapsed-host.test.ts';
import { localSession } from './session.ts';
import { bundle as deerBundle } from '../../../kernel/ts/test/deer_fixture.ts';
import { bundle as patrolBundle } from '../../../kernel/ts/test/patrol_fixture.ts';
import { practicalHost } from './__tests__/practical-host.ts';

// Breaks: the test replay kept by coldReopen stops comparing a replayed decision with the stored one,
// so every sampler's determinism cover passes vacuously. Open itself accepts the same forgery.
test('coldReopen replays a lawful save and refuses a receipt its replay does not produce', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-history-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'save.db'),
    bundle = elapsedBundle(),
    a = elapsedHost(path, undefined, bundle);
  const reply = a.game.invoke({ action_key: 'look', target_ids: [], input: {} } as never);
  assert.equal(reply.kind, 'saved');
  coldReopen(path, bundle);
  const row = a.sql.prepare('SELECT invocation_id, response FROM receipt').get()!;
  a.sql
    .prepare('UPDATE receipt SET response=? WHERE invocation_id=?')
    .run(
      JSON.stringify({ ...JSON.parse(row.response as string), outcome: 'edited' }),
      row.invocation_id as string,
    );
  assert.throws(() => coldReopen(path, bundle), /malformed JSON/);
  a.sql.close();
});

function played(
  t: { after: (f: () => void) => void },
  bundle: ReturnType<typeof patrolBundle> = patrolBundle(),
  directions = ['north', 'north'],
) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-history-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'save.db'),
    a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  t.after(() => a.sql.close());
  for (const direction of directions)
    assert.equal(
      a.game.invoke({ action_key: 'move', target_ids: [], input: { direction } } as never).kind,
      'saved',
    );
  const receipts = a.sql
    .prepare('SELECT command_id, response FROM receipt ORDER BY revision')
    .all() as { command_id: string; response: string }[];
  const edit = (i: number, change: (d: any) => unknown) =>
    a.sql
      .prepare('UPDATE receipt SET response=? WHERE command_id=?')
      .run(JSON.stringify(change(JSON.parse(receipts[i].response))), receipts[i].command_id);
  // The app's route: a fresh handle under localSession, whose failed() the Fault page shows.
  const session = () => {
    a.sql.close();
    a.sql.open();
    return localSession(() => a.db, assert.fail, bundle, a.host);
  };
  return { a, path, bundle, receipts, edit, session };
}

// Breaks: the test replay stops comparing saved rows with the state it derives, so a writer or kernel
// bug that saves wrong rows passes CI; nothing in production checks this any more.
test('coldReopen refuses saved rows its replay does not produce', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-history-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'save.db'),
    bundle = elapsedBundle(),
    a = elapsedHost(path, undefined, bundle);
  a.game.invoke({ action_key: 'look', target_ids: [], input: {} } as never);
  coldReopen(path, bundle);
  const gone = a.sql.prepare("DELETE FROM state_row WHERE section='resources'").run();
  assert.ok(Number(gone.changes) > 0);
  assert.throws(() => coldReopen(path, bundle), /malformed JSON/);
  a.sql.close();
});

// Breaks: open stops comparing the head with the newest receipt, so a save missing its newest receipt
// (or with one the head never counted) opens and retries that command under a used revision.
test('open refuses a head that is not the newest receipt, and offers Start over', (t) => {
  const { a, receipts, session } = played(t);
  a.sql.prepare('DELETE FROM receipt WHERE command_id=?').run(receipts[1].command_id);
  const s = session();
  assert.equal(s.game(), undefined);
  assert.equal(s.failed()?.kind, 'save_corrupt');
  assert.equal(s.failed()?.startOver, true);
});

// Breaks: a reader's TypeError on a row of the wrong shape (deerSave in load; the newest receipt's
// narration in openGame) escapes as a crash, startOver false, and the player is stuck on that save.
for (const [name, at, bundle, directions] of [
  ['an older receipt', 0, deerBundle, ['south', 'south', 'west']],
  ['the newest receipt', 1, patrolBundle(), ['north', 'north']],
] as const)
  test(`a null op in ${name} reaches the Fault page with Start over`, (t) => {
    const { edit, session } = played(t, bundle, [...directions]);
    edit(at, (d) => ({ ...d, delta: { ...d.delta, ops: [null] } }));
    const s = session();
    assert.equal(s.game(), undefined);
    assert.equal(s.failed()?.kind, 'save_corrupt');
    assert.equal(s.failed()?.startOver, true);
    assert.equal(s.startOver(), undefined);
    assert.ok(s.game());
  });

// Breaks: a shape a loader or narration trips on strands the player on a fault with no way forward.
test('a null op in any receipt opens or offers Start over', (t) => {
  for (const [bundle, directions] of [
    [patrolBundle(), ['north', 'north']],
    [deerBundle, ['south', 'south', 'west']],
  ] as const) {
    const count = played(t, bundle, [...directions]).receipts.length;
    for (let i = 0; i < count; i++) {
      const { edit, session } = played(t, bundle, [...directions]);
      edit(i, (d) => ({ ...d, delta: { ...d.delta, ops: [null] } }));
      const s = session();
      assert.ok(s.game() || s.failed()?.startOver, `receipt ${i}: ${s.failed()?.message}`);
    }
  }
});

// Breaks: the skills loader trips on an older receipt's null op: a plain fault, not a refusal.
test('a null op in an older receipt of a world with skills refuses as corrupt', (t) => {
  const a = practicalHost();
  t.after(() => a.sql.close());
  for (const direction of ['east', 'west']) a.invoke('move', [], { direction });
  const first = a.sql.prepare('SELECT command_id, response FROM receipt ORDER BY revision').get()!;
  a.sql
    .prepare('UPDATE receipt SET response=? WHERE command_id=?')
    .run(
      JSON.stringify({ ...JSON.parse(first.response as string), delta: { ops: [null] } }),
      first.command_id as string,
    );
  assert.throws(() => a.reopen(), /save_corrupt/);
});

// Breaks: a bug of ours reading a lawful save offers Start over, and confirming wipes what an update would open.
for (const [name, method, sql] of [
  ['load', 'getAllSync', /FROM receipt/],
  [
    'the narration read',
    'getFirstSync',
    /SELECT revision, command_id, command, response FROM receipt WHERE scope = ?/,
  ],
] as const)
  test(`a TypeError in ${name} on a lawful save is a plain fault with the bytes kept`, (t) => {
    const { a, session } = played(t);
    const bytes = () => JSON.stringify(a.sql.prepare('SELECT * FROM receipt').all());
    const before = bytes();
    const real = a.db[method].bind(a.db) as (...v: unknown[]) => unknown;
    t.mock.method(a.db, method, (q: string, ...v: unknown[]) => {
      if (sql.test(q)) throw new TypeError('planted');
      return real(q, ...v);
    });
    const s = session();
    assert.equal(s.game(), undefined);
    assert.equal(s.failed()?.message, 'planted');
    assert.equal(s.failed()?.startOver, false);
    t.mock.restoreAll();
    assert.equal(bytes(), before);
  });

// Breaks: an older receipt no loader reads opens, then the Journal's read throws in render: no boundary.
test('the Journal skips an older receipt of the wrong shape', (t) => {
  const { edit, session } = played(t);
  const whole = session().game()!.chronicle();
  edit(0, () => null);
  const s = session();
  assert.equal(whole.length, 2);
  assert.deepEqual(s.game()!.chronicle(), whole.slice(1));
});
