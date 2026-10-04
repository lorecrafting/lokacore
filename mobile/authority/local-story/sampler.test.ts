// C1 sampler: one normal-invocation walk through the approved source, on real SQLite.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { gameView, INSTALLED } from '../../../kernel/ts/src/runtime/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory, type Saved } from './authority.ts';

const kat = read('protocol/fixtures/cartridge_sampler_hash.json');
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok);
const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
// Independent Python IdSource oracle: character/body, ten sorted rooms, then Bram/five rats/items/scheduled job/slot.
// Context 0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f; see M5 provenance for literal ordinals.
const ids = {
  bram: '15349791-fa65-81f7-b378-bb8212b808d2',
  brass_key: 'f14e477f-cecc-897a-bee7-c573aa5c76c3',
  cellar_key: '58ee172d-aa6f-8023-a3c1-a1d46af6d167',
  lantern: '19785203-d373-8973-8e64-1a9d8e50be82',
  tin_whistle: '05f6aca0-79cd-83fe-8096-bae95b0730e8',
  trunk: 'd68b48e6-93a5-8899-81ec-808f7be333f8',
  wool_cloak: '2603d738-5a68-83d2-93fe-8e50819f9741',
};
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
function open(sql: DatabaseSync) {
  const o = openStory(adapt(sql), [{ content_hash: kat.sha256, fresh }], host);
  assert.equal(o.kind, 'open');
  if (o.kind !== 'open') throw new Error('unreachable');
  const view = () => gameView(o.world());
  const invoke = (
    action_key: string,
    input: object = {},
    target?: keyof typeof ids,
    code = 'accepted',
  ) => {
    const invocation = {
      invocation_id: host.newId(),
      action_key,
      actor_id: fresh.character,
      target_ids: target ? [ids[target]] : [],
      input,
    };
    const reply = o.invoke(invocation) as Saved;
    assert.equal(reply.kind, 'saved', action_key);
    const decision = reply.decision as { kind: string; error?: { code: string } };
    assert.equal(
      decision.kind === 'accepted' ? 'accepted' : decision.error?.code,
      code,
      action_key,
    );
    return { invocation, reply };
  };
  const choose = (choice_id: string) =>
    invoke('choose', { choice_id, continuation_id: view().choice!.continuation_id });
  const move = (direction: string, room: string, code = 'accepted') => {
    invoke('move', { direction }, undefined, code);
    assert.equal(view().place.title.key, `room.${room}.title`);
  };
  const journal = (state: string, text: string) => {
    assert.deepEqual(
      view().journal.map((q) => [q.state, q.journal]),
      [[state, text]],
    );
  };
  return { o, view, invoke, choose, move, journal };
}

// Breaks: inaccessible mandatory rooms/keys, wrong slot or point-choice pairing, missing
// offer/scene trigger, or persistence losing the sampler's terminal quest/current scene line.
test('sampler invocation walk reaches all six rooms and resumes the carried ending at line two', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-sampler-'));
  const path = join(dir, 'save.db');
  let sql = new DatabaseSync(path);
  try {
    let p = open(sql);
    assert.equal(fresh.character, 'bd595711-ea5f-89a5-abb0-046cd349d2f9');
    assert.equal(fresh.slots.cloak, 'b59d54de-ea10-84e1-964c-16d1c776e738');
    // Breaks: missing authored bands fall back to perfect_health, or the band label is absent.
    const hp = p.view().resources!.find((r) => r.resource.key === 'hp')!;
    assert.deepEqual([hp.band, hp.tone], ['ready', 'normal']);
    assert.equal(p.o.world().cartridge.text['band.ready'], 'is in perfect health');
    assert.equal(p.view().position, 'standing');
    assert.deepEqual(p.view().chapter, { index: 0, title: 'chapter.lantern' });
    assert.deepEqual(p.view().journal, []);
    assert.equal(p.view().scene, undefined);
    // Breaks: the sampler omits Look's capability or a no-target Look becomes an examine.
    assert.ok(p.view().actions.some((a) => a.action_key === 'look'));
    const looked = p.invoke('look');
    assert.equal((looked.reply.decision as { outcome: string }).outcome, 'looked');
    assert.equal(p.view().place.title.key, 'room.ferry_landing.title');
    assert.equal(p.view().place.description.key, 'room.ferry_landing.description');
    assert.equal(p.view().exits[0].sight?.entities[0].name, 'item.lantern.short');
    p.invoke('bram_offer', {}, 'bram');
    assert.equal(p.view().choice!.prompt.key, 'dialogue.bram_offer.prompt');
    assert.deepEqual(
      p.view().choice!.choices.map((c) => c.choice_id),
      ['accept'],
    );
    p.choose('accept');
    p.journal('active', 'quest.lantern.find');
    p.move('north', 'well_lane');
    p.invoke('take', {}, 'lantern');
    p.journal('active', 'quest.lantern.return');
    p.invoke('drop', {}, 'lantern');
    p.journal('active', 'quest.lantern.find');
    p.invoke('take', {}, 'lantern');
    p.move('east', 'drowned_lantern');
    p.move('down', 'drowned_lantern', 'exit_locked');
    assert.equal(p.view().exits.find((e) => e.direction === 'down')!.door!.state, 'locked');
    p.move('up', 'inn_rooms');
    for (const item of ['cellar_key', 'brass_key', 'wool_cloak'] as const)
      p.invoke('take', {}, item);
    p.invoke('wear', {}, 'wool_cloak');
    assert.equal(p.view().equipment![0].slot, 'cloak');
    assert.equal(p.view().equipment![0].item!.id, ids.wool_cloak);
    p.invoke('remove', {}, 'wool_cloak');
    assert.equal(p.view().equipment![0].item, undefined);
    for (const [action, position] of [
      ['sit', 'sitting'],
      ['rest', 'resting'],
      ['stand', 'standing'],
    ]) {
      p.invoke(action);
      assert.equal(p.view().position, position);
    }
    p.move('up', 'inn_attic');
    p.invoke('unlock', {}, 'trunk');
    assert.equal(p.view().entities.find((e) => e.id === ids.trunk)!.state, 'closed');
    p.invoke('open', {}, 'trunk');
    assert.equal(
      p.view().entities.find((e) => e.id === ids.trunk)!.contents![0].id,
      ids.tin_whistle,
    );
    p.invoke('take', {}, 'tin_whistle');
    p.move('down', 'inn_rooms');
    p.move('down', 'drowned_lantern');
    p.invoke('unlock', { direction: 'down' });
    assert.equal(p.view().exits.find((e) => e.direction === 'down')!.door!.state, 'closed');
    p.invoke('open', { direction: 'down' });
    p.move('down', 'lantern_cellar');
    assert.equal(p.view().exits[0].door!.state, 'open');
    p.invoke('close', { direction: 'up' });
    assert.equal(p.view().exits[0].door!.state, 'closed');
    p.invoke('open', { direction: 'up' });
    p.move('up', 'drowned_lantern');
    p.move('west', 'well_lane');
    p.move('south', 'ferry_landing');
    p.invoke('bram', {}, 'bram');
    assert.deepEqual(
      p.view().choice!.choices.map((c) => c.choice_id),
      ['leave_it', 'take_it'],
    );
    const trigger = p.choose('take_it');
    p.journal('resolved', 'quest.lantern.carried');
    assert.deepEqual(p.view().chapter, { index: 1, title: 'chapter.bank' });
    assert.deepEqual(
      p.view().actions.map((a) => a.action_key),
      ['continue'],
    );
    assert.equal(p.view().scene!.line, 'scene.lantern_kept.bram');
    p.invoke('continue');
    assert.equal(p.view().scene!.index, 2);
    assert.equal(p.view().scene!.line, 'scene.lantern_kept.brass');
    const revision = sql.prepare('SELECT revision FROM head').get()!.revision;
    const facts = sql
      .prepare("SELECT value FROM state_row WHERE section='facts'")
      .all()
      .map((r) => JSON.parse(r.value as string));
    assert.deepEqual(facts.sort(), [2, 'player_led', 'standing'].sort());
    const reports = sql.prepare('SELECT count(*) AS n FROM report').get()!.n;
    assert.equal(reports, 1);
    sql.close();
    sql = new DatabaseSync(path);
    p = open(sql);
    assert.equal(p.view().scene!.index, 2);
    assert.equal(p.view().scene!.line, 'scene.lantern_kept.brass');
    assert.equal(p.view().scene!.count, 3);
    p.journal('resolved', 'quest.lantern.carried');
    assert.deepEqual(
      p.o.invoke(trigger.invocation),
      JSON.parse(JSON.stringify({ ...trigger.reply, replay: true })),
    );
    assert.equal(sql.prepare('SELECT revision FROM head').get()!.revision, revision);
    assert.equal(sql.prepare('SELECT count(*) AS n FROM report').get()!.n, reports);
    p.invoke('continue');
    assert.equal(p.view().scene!.index, 3);
    assert.equal(p.view().scene!.line, 'scene.lantern_kept.river');
    p.invoke('continue');
    assert.equal(p.view().scene, undefined);
    assert.deepEqual(p.view().chapter, { index: 1, title: 'chapter.bank' });
    assert.deepEqual(
      p
        .view()
        .inventory.map((i) => i.id)
        .sort(),
      [ids.brass_key, ids.cellar_key, ids.lantern, ids.tin_whistle, ids.wool_cloak].sort(),
    );
    const records = sql
      .prepare('SELECT record FROM trace ORDER BY rowid')
      .all()
      .map((r) => JSON.parse(r.record as string));
    assert.equal(records.filter((r) => r.event === 'trace.command').length, 37);
    assert.equal(sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, 37);
  } finally {
    sql.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// Breaks: leave_it incorrectly uses the carry journal/chapter/scene, or omits hand-over to Bram.
test('leaving the lantern resolves with the fallback journal and no carried chapter or scene', () => {
  const sql = new DatabaseSync(':memory:');
  try {
    const p = open(sql);
    p.invoke('bram_offer', {}, 'bram');
    p.choose('accept');
    p.move('north', 'well_lane');
    p.invoke('take', {}, 'lantern');
    p.move('south', 'ferry_landing');
    p.invoke('bram', {}, 'bram');
    p.choose('leave_it');
    p.journal('resolved', 'quest.lantern.done');
    assert.equal(p.o.world().state.containers[ids.lantern], ids.bram);
    assert.deepEqual(p.view().chapter, { index: 0, title: 'chapter.lantern' });
    assert.equal(p.view().scene, undefined);
  } finally {
    sql.close();
  }
});
