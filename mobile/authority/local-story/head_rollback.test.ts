// Reopen ties the head clock to the receipt chain (save.md, The save file).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { read } from '../../../kernel/ts/test/read.ts';
import { openGame } from './session.ts';
import { elapsedHost, receipts } from './__tests__/elapsed-host.test.ts';

// Breaks: reopen trusts a head clock rolled back behind the newest committed receipt, so the
// next pulse rewrites the save from the forged clock.
test('a head clock behind the newest committed receipt refuses with bytes unchanged', () => {
  const a = elapsedHost(
    ':memory:',
    { wall: 10000, mono: 0 },
    read('protocol/fixtures/missing_child_v042_hash.json'),
  );
  const reply = a.game.invoke({
    action_key: 'choose_ancestry',
    target_ids: [],
    input: { ancestry: 'fen_born' },
  } as never);
  assert.ok(reply.kind === 'saved' && reply.decision.kind === 'accepted');
  a.clock.wall += 20000;
  a.clock.mono += 20000;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.equal(receipts(a.sql), 2); // the choice and one elapsed receipt
  a.sql.exec('UPDATE head SET clock = clock - 1');
  const disk = () => [
    a.sql.prepare('SELECT * FROM head').get(),
    a.sql.prepare('SELECT * FROM receipt ORDER BY revision').all(),
  ];
  const before = disk();
  assert.throws(
    () => openGame(a.db, a.bundle, a.host),
    (e: any) => e.cause.kind === 'save_corrupt',
  );
  assert.deepEqual(disk(), before);
  a.sql.close();
});
