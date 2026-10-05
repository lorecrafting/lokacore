// SCENE-01 / QUESTSCENE-01: real SQLite reopen at line two and retried triggering receipt.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { hash } from '../../../kernel/ts/src/foundation/canonical.ts';
import type { Command, WorldContextId } from '../../../kernel/ts/src/contracts.gen.ts';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { gameView, INSTALLED, step } from '../../../kernel/ts/src/runtime/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory, type Saved } from './authority.ts';
const kat = read('protocol/fixtures/cartridge_scene_hash.json');
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok);
const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId,
  [1, 2, 3, 4],
);
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
  const o = openStory(adapt(sql), [{ content_hash: kat.sha256, fresh }], host);
  assert.equal(o.kind, 'open');
  if (o.kind !== 'open') throw new Error('unreachable');
  return o;
};
function play(o: ReturnType<typeof open>) {
  let carry: { invocation: any; reply: Saved } | undefined;
  for (const [action_key, target] of [
    ['lantern', undefined],
    ['take', 'item/lantern'],
    ['bram', 'npc/bram'],
    ['choose', undefined],
    ['continue', undefined],
  ]) {
    const input =
      action_key === 'choose'
        ? { choice_id: 'carry', continuation_id: gameView(o.world()).choice!.continuation_id }
        : action_key === 'continue'
          ? { scene: gameView(o.world()).scene!.scene, line: gameView(o.world()).scene!.index }
          : {};
    const invocation = {
      invocation_id: host.newId(),
      action_key,
      actor_id: fresh.character,
      target_ids: target ? [fresh.entityIds[`ashmere_scene@0.0.1:${target}`]] : [],
      input,
    };
    const reply = o.invoke(invocation) as Saved;
    assert.equal(reply.kind, 'saved');
    assert.equal((reply.decision as { kind: string }).kind, 'accepted');
    if (action_key === 'choose') carry = { invocation, reply };
  }
  return carry!;
}
function replay(sql: DatabaseSync) {
  let world = fresh;
  const entries = sql
    .prepare('SELECT record FROM trace ORDER BY rowid')
    .all()
    .map((r) => JSON.parse(r.record as string))
    .filter((r) => r.event === 'trace.command');
  for (const e of entries) {
    const c = e.data.command as Command;
    const s = step(world, c, e.data.commit.revision);
    assert.equal(s.decision.kind, 'accepted');
    if (s.decision.kind !== 'accepted') throw new Error('unreachable');
    assert.equal(hash(s.decision.delta as never), e.data.decision.delta_digest);
    assert.deepEqual(
      JSON.parse(JSON.stringify(s.decision.events)),
      e.data.commit.events.map((x: any) => x.event),
    );
    world = s.world;
  }
  return world;
}
// Breaks: scene fact row lost/reset on reopen, replay starts/advances it again, or receipt retry
// issues the trigger anew. Assert literal persisted line before comparing actual command replay.
test('line two survives reopen and triggering receipt retry without duplicate effects', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-scene-'));
  const path = join(dir, 'save.db');
  let sql = new DatabaseSync(path);
  try {
    const o = open(sql);
    const carry = play(o);
    const expected = replay(sql);
    const facts = sql
      .prepare("SELECT value FROM state_row WHERE section='facts' ORDER BY key")
      .all()
      .map((r) => JSON.parse(r.value as string));
    assert.deepEqual(facts.sort(), [2, 'player_led'].sort());
    const revision = sql.prepare('SELECT revision FROM head').get()!.revision;
    const traceCount = sql.prepare('SELECT count(*) AS n FROM trace').get()!.n;
    sql.close();
    sql = new DatabaseSync(path);
    const reopened = open(sql);
    assert.deepEqual(gameView(reopened.world()).scene, {
      scene: {
        cartridge_id: 'ashmere_scene',
        cartridge_version: '0.0.1',
        kind: 'scene',
        key: 'bell_rung',
      },
      line: 'scene.bell_rung.fen',
      index: 2,
      count: 3,
    });
    assert.equal(hash(reopened.world().state as never), hash(expected.state as never));
    assert.deepEqual(
      reopened.invoke(carry.invocation),
      JSON.parse(JSON.stringify({ ...carry.reply, replay: true })),
    );
    assert.equal(hash(reopened.world().state as never), hash(expected.state as never));
    assert.equal(sql.prepare('SELECT revision FROM head').get()!.revision, revision);
    assert.equal(sql.prepare('SELECT count(*) AS n FROM trace').get()!.n, traceCount);
    assert.equal(hash(replay(sql).state as never), hash(expected.state as never));
  } finally {
    sql.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
