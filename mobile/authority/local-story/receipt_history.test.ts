import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { coldReopen, elapsedBundle, elapsedHost } from './__tests__/elapsed-host.test.ts';

// Breaks: the dev replay kept by coldReopen stops comparing a replayed decision with the stored one,
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
      JSON.stringify({ ...JSON.parse(row.response as string), narration: [] }),
      row.invocation_id as string,
    );
  assert.throws(() => coldReopen(path, bundle), /malformed JSON/);
  a.sql.close();
});
