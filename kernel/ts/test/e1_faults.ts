// v042 storage anchors: ancestry is revision 1; one north move is revision 2.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { encode, hash } from '../src/foundation/canonical.ts';
import type { CaseHost } from './e1_case_host.ts';

export const FAULTS = ['full', 'failed', 'lost'] as const;
export type Fault = (typeof FAULTS)[number];
export const faultSchedule = (kind: Fault) => [
  {
    after_revision: 1,
    operation: kind === 'full' ? 'next transaction write: SQLITE_FULL' : 'next COMMIT',
    fault_kind: kind,
    receipt_reads_unavailable: kind !== 'full',
  },
];

export function storageFault(a: CaseHost, path: string, kind: Fault) {
  a.invoke('choose_ancestry', [], { ancestry: 'fen_born' });
  const before = hash(a.story.world().state as never);
  const head = () => ({ ...a.sql.prepare('SELECT revision, clock FROM head').get()! });
  const rows = () =>
    JSON.stringify(
      ['head', 'state_row', 'receipt'].map((table) =>
        a.sql.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all(),
      ),
    );
  const stored = rows(),
    move = a.attempt('move', [], { direction: 'north' });
  assert.deepEqual(head(), { revision: 1, clock: 64800 });
  a.record({ kind: 'fault', ...faultSchedule(kind)[0] });
  if (kind === 'full') {
    const pages = a.sql.prepare('PRAGMA page_count').get()!.page_count;
    a.sql.exec(`PRAGMA max_page_count=${pages}`);
    assert.throws(() => a.send(move), { errcode: 13 });
    assert.equal(rows(), stored);
    a.sql.exec('PRAGMA max_page_count=1073741823');
  } else {
    if (kind === 'failed')
      a.sql.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE parent(id INTEGER PRIMARY KEY);
      CREATE TABLE child(id INTEGER REFERENCES parent DEFERRABLE INITIALLY DEFERRED);`);
    a.fault.kind = kind;
    a.fault.armed = true;
    assert.deepEqual(a.send(move), { kind: 'pending' });
    assert.deepEqual(a.send(a.attempt('look')), { kind: 'pending' });
    assert.equal(a.sql.isTransaction, false);
    assert.deepEqual(head(), { revision: kind === 'lost' ? 2 : 1, clock: 64800 });
    if (kind === 'failed') assert.equal(rows(), stored);
    a.fault.reads = false;
  }
  assert.equal(hash(a.story.world().state as never), before, 'fault adopted unconfirmed memory');
  const saved = a.send(move);
  assert.equal(saved.kind, 'saved');
  if (saved.kind !== 'saved') throw new Error('fault did not settle');
  assert.equal(saved.replay, kind === 'lost');
  assert.equal(saved.revision, 2);
  assert.equal(a.view().place.title.key, 'room.well_lane.title');
  const durable = new DatabaseSync(path, { readOnly: true });
  try {
    assert.equal(
      durable.prepare('SELECT revision FROM receipt WHERE invocation_id=?').get(move.invocation_id)!
        .revision,
      2,
      'saved lacks a durable receipt',
    );
  } finally {
    durable.close();
  }
  const after = hash(a.story.world().state as never);
  a.reopen();
  assert.equal(hash(a.story.world().state as never), after);
  assert.equal(encode(a.send(move) as never), encode({ ...saved, replay: true } as never));
  assert.deepEqual(a.send({ ...move, input: { direction: 'south' } }), { kind: 'conflict' });
  assert.deepEqual(head(), { revision: 2, clock: 64800 });
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, 2);
  assert.equal(hash(a.story.world().state as never), after);
  return {
    fault: kind,
    revision: 2,
    clock: 64800,
    location: 'well_lane',
    receipts: 2,
    durable: true,
    duplicate: 'replay',
    changed_duplicate: 'conflict',
  };
}
