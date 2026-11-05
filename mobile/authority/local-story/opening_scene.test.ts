// scene@1 opening scene (mechanics.md scene@1) across real SQLite reopens: the line a save shows
// is the persisted one, and an ended opening scene never replays on a later launch.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { gameView } from '../../../kernel/ts/src/runtime/world.ts';
import { fragment } from '../../../kernel/ts/test/fragment.ts';
import { opening } from '../../../kernel/ts/test/opening_fixture.ts';
import { openStory } from './authority.ts';
const f = fragment('protocol/fixtures/cartridge_scene_hash.json');
const fresh = f.genesis(opening);
const adapt = (sql: DatabaseSync) => ({
  execSync: (s: string) => void sql.exec(s),
  runSync: (s: string, ...p: (string | number | null)[]) => sql.prepare(s).run(...p),
  getFirstSync: <T>(s: string, ...p: (string | number | null)[]) =>
    (sql.prepare(s).get(...p) ?? null) as T | null,
  getAllSync: <T>(s: string, ...p: (string | number | null)[]) => sql.prepare(s).all(...p) as T[],
  isInTransactionSync: () => sql.isTransaction,
});
let n = 0;
const host = {
  kernel_version: `loka-kernel@${'0123456789'.repeat(4)}`,
  newId: () => `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`,
};
const open = (sql: DatabaseSync) => {
  const o = openStory(adapt(sql), [{ content_hash: f.bundle(opening).sha256, fresh }], host);
  assert.equal(o.kind, 'open');
  if (o.kind !== 'open') throw new Error('unreachable');
  return o;
};
const line = (o: ReturnType<typeof open>) => gameView(o.world()).scene?.index;
function next(o: ReturnType<typeof open>) {
  const { scene, index } = gameView(o.world()).scene!;
  const reply = o.invoke({
    invocation_id: host.newId(),
    action_key: 'continue',
    actor_id: fresh.character,
    target_ids: [],
    input: { scene, line: index },
  }) as { kind: string };
  assert.equal(reply.kind, 'saved');
}

// Breaks: a reopen rebuilds the opening scene from genesis (back to line 1) instead of the saved
// line, or a later launch starts the ended scene again.
test('an opening scene resumes on its saved line and never replays once ended', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-opening-'));
  const path = join(dir, 'save.db');
  let sql = new DatabaseSync(path);
  const reopen = () => {
    sql.close();
    sql = new DatabaseSync(path);
    return open(sql);
  };
  try {
    let o = open(sql);
    assert.equal(line(o), 1);
    o = reopen();
    assert.equal(line(o), 1);
    next(o);
    o = reopen();
    assert.equal(line(o), 2);
    next(o);
    assert.equal(line(o), undefined);
    o = reopen();
    assert.equal(line(o), undefined);
    assert.equal(gameView(o.world()).place.title.key, 'room.ferry_landing.title');
  } finally {
    sql.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
