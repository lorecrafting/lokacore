import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { read } from '../../../kernel/ts/test/read.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

const bundle = read('protocol/fixtures/missing_child_v017_hash.json');
const ids = read('protocol/fixtures/missing_child_v017_ids.json');

// Breaks: an acknowledged finale cannot reopen from its Begin, intermediate lines, or exported ending.
test('acknowledged Green finale reopens at every line and exports one report', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-finale-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'story.db');
  let a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const view = () => a.game.view().view;
  const ok = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    if (action_key === 'continue')
      input = { scene: view().scene!.scene, line: view().scene!.index };
    const r = a.game.invoke({ action_key, target_ids, input } as never);
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved') assert.equal(r.decision.kind, 'accepted', JSON.stringify(r));
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => ok('move', [], { direction }));
  const choose = (choice_id: string, answer?: string) =>
    ok('choose', [], {
      continuation_id: view().choice!.continuation_id,
      choice_id,
      ...(answer && { answer }),
    });
  const reopen = () => {
    a.sql.close();
    a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  };
  ok('elspeth', [ids['npc/elspeth']]);
  choose('accept');
  move('north', 'north');
  ok('take', [ids['item/fox_drawing']]);
  move('south', 'south');
  ok('a_elspeth_report', [ids['npc/elspeth']]);
  choose('report');
  move('south', 'south');
  ok('study_tracks');
  move('north', 'north', 'north', 'north', 'north', 'north', 'north');
  ok('a_aldric_offer', [ids['npc/aldric']]);
  choose('accept');
  move('up', 'up');
  ok('ring_bell', [ids['detail/bell']]);
  for (let i = 0; i < 3; i++) ok('continue');
  move('down', 'down', 'south', 'south', 'south');
  assert.equal(view().place.id, ids['room/village_green']);
  assert.equal(view().scene, undefined);
  ok('begin_epilogue_lost_prior', [ids['detail/market_cross']]);
  for (const line of [1, 2, 3]) {
    reopen();
    assert.equal(view().scene?.index, line);
    ok('continue');
  }
  reopen();
  assert.equal(view().chapter?.index, 1);
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM report').get()!.n, 1);
  const head = a.sql.prepare('SELECT revision FROM head').get()!.revision as number;
  const corrupt = () =>
    assert.throws(
      () => elapsedHost(path, { wall: 10000, mono: 0 }, bundle),
      (e: unknown) => (e as { cause?: { kind?: string } }).cause?.kind === 'save_corrupt',
    );
  // Missing acknowledged bell receipts cannot justify the retained -1 bell fact.
  const bellReceipts = a.sql
    .prepare(
      "SELECT * FROM receipt WHERE json_extract(command,'$.payload.type')='continue' AND json_extract(command,'$.payload.scene.key')='bell_rung'",
    )
    .all();
  assert.equal(bellReceipts.length, 3);
  for (const row of bellReceipts)
    a.sql
      .prepare('DELETE FROM receipt WHERE scope=? AND invocation_id=?')
      .run(row.scope, row.invocation_id);
  corrupt();
  for (const row of bellReceipts)
    a.sql
      .prepare(
        'INSERT INTO receipt (scope,invocation_id,command_id,actor_id,intent_digest_version,intent_digest,command,revision,response) VALUES (?,?,?,?,?,?,?,?,?)',
      )
      .run(
        row.scope,
        row.invocation_id,
        row.command_id,
        row.actor_id,
        row.intent_digest_version,
        row.intent_digest,
        row.command,
        row.revision,
        row.response,
      );
  // A Begin receipt after the saved head cannot precede the acknowledged finale lines.
  const begin = a.sql
    .prepare(
      "SELECT scope,invocation_id,revision FROM receipt WHERE json_extract(command,'$.payload.action')='begin_epilogue_lost_prior'",
    )
    .get()!;
  a.sql
    .prepare('UPDATE receipt SET revision=? WHERE scope=? AND invocation_id=?')
    .run(head + 1, begin.scope, begin.invocation_id);
  corrupt();
  a.sql
    .prepare('UPDATE receipt SET revision=? WHERE scope=? AND invocation_id=?')
    .run(begin.revision, begin.scope, begin.invocation_id);
  assert.equal(a.sql.prepare('SELECT revision FROM head').get()!.revision, head);
  const report = a.sql.prepare('SELECT report_id,report FROM report').get() as {
    report_id: string;
    report: string;
  };
  const forged = JSON.parse(report.report);
  forged.observed_revision++;
  a.sql
    .prepare('UPDATE report SET report=? WHERE report_id=?')
    .run(JSON.stringify(forged), report.report_id);
  assert.throws(
    () => elapsedHost(path, { wall: 10000, mono: 0 }, bundle),
    (e: unknown) => (e as { cause?: { kind?: string } }).cause?.kind === 'save_corrupt',
  );
  a.sql
    .prepare('UPDATE report SET report=? WHERE report_id=?')
    .run(report.report, report.report_id);
  // The exported memory must still agree with the acknowledged receipt on cold open.
  const memory = a.sql
    .prepare("SELECT key FROM state_row WHERE section='facts' AND value='\"stilled\"'")
    .get()!.key as string;
  assert.equal(
    a.sql
      .prepare("UPDATE state_row SET value='\"free\"' WHERE section='facts' AND key=?")
      .run(memory).changes,
    1,
  );
  assert.throws(
    () => elapsedHost(path, { wall: 10000, mono: 0 }, bundle),
    (e: unknown) => (e as { cause?: { kind?: string } }).cause?.kind === 'save_corrupt',
  );
  a.sql
    .prepare("UPDATE state_row SET value='\"stilled\"' WHERE section='facts' AND key=?")
    .run(memory);
  reopen();
  // Starting over retains the old report, which must not claim completion in the fresh run.
  let next = 0;
  a.host.newId = () => `bbbbbbbb-0000-4000-8000-${String(++next).padStart(12, '0')}`;
  assert.deepEqual(a.game.newGame(), { kind: 'replaced' });
  reopen();
  assert.equal(view().scene, undefined);
  assert.equal(view().chapter?.index, 0);
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM report').get()!.n, 1);
  a.sql.close();
});
