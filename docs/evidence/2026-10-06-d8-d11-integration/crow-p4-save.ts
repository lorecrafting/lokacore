// Required P4 scenario proof using real invocations, cold databases and operation faults.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setup } from '../../../mobile/authority/local-story/crows.test.ts';
import { elapsedHost } from '../../../mobile/authority/local-story/__tests__/elapsed-host.test.ts';
import { openStory } from '../../../mobile/authority/local-story/authority.ts';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { entity, prefix, ref } from '../../../kernel/ts/test/transport_fixture.ts';

type A = ReturnType<typeof setup>;
let reopens = 0, faults = 0;
function cold(a: A, path: string) {
  const before = encode(a.s.world().state as never);
  a.p.sql.close();
  const q = elapsedHost(path, { wall: 10000, mono: 0 }, a.b);
  try {
    if (process.argv.includes('--red-control')) q.sql.prepare("UPDATE state_row SET value=? WHERE section='containers' AND key=?").run(JSON.stringify(a.s.world().body), a.coin);
    const opened = openStory(q.db, a.releases, q.host);
    assert.equal(opened.kind, 'open');
    if (opened.kind === 'open') assert.equal(encode(opened.world().state as never), before);
    reopens++;
  } finally { q.sql.close(); }
}
function faultInvoke(a: A, kind: 'failed' | 'lost', action_key: string, target_ids: string[]) {
  const input = { invocation_id: 'dddddddd-0000-4000-8000-000000000001', actor_id: a.s.world().character, action_key, target_ids, input: {} };
  const before = encode(a.s.world().state as never);
  const rows = a.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
  if (kind === 'failed') a.p.sql.exec('PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)');
  a.p.fault.kind = kind; a.p.fault.armed = true;
  assert.equal(a.s.invoke(input).kind, 'pending');
  assert.equal(encode(a.s.world().state as never), before);
  a.p.fault.reads = false;
  if (kind === 'failed') assert.deepEqual(a.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(), rows);
  const saved = a.s.invoke(input);
  assert.equal(saved.kind, 'saved');
  if (saved.kind === 'saved') { assert.equal(saved.replay, kind === 'lost'); assert.equal((saved.decision as any).kind, 'accepted'); }
  const after = a.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
  const replay = a.s.invoke(input); assert.equal(replay.kind, 'saved');
  if (replay.kind === 'saved') assert.equal(replay.replay, true);
  assert.deepEqual(a.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(), after);
  faults++;
}
for (const mode of ['moved', 'closed', 'full'] as const) {
  for (const stage of ['configured', 'fallback'] as const) {
    const dir = mkdtempSync(join(tmpdir(), 'loka-crow-p4-'));
    const path = join(dir, 'save.db');
    const a = setup(path, c => { c.entry = ref('room', 'willow_shade'); }, 'fen_born');
    try {
      if (mode === 'full') for (let i = 1; i <= 8; i++) a.invoke('take', [entity(a.s.world(), 'item', `fenwort_${String(i).padStart(2, '0')}`)]);
      a.invoke('move', [], { direction: 'south' }); a.invoke('move', [], { direction: 'up' });
      const nest = entity(a.s.world(), 'item', 'crow_nest');
      if (mode === 'moved') a.invoke('take', [nest]);
      if (mode === 'closed') a.invoke('close', [nest]);
      if (mode === 'full') for (let i = 1; i <= 8; i++) a.invoke('put', [entity(a.s.world(), 'item', `fenwort_${String(i).padStart(2, '0')}`), nest]);
      for (const direction of ['down', 'north', 'east', 'north', 'north', 'north', 'north']) a.invoke('move', [], { direction });
      if (mode === 'moved') a.invoke('drop', [nest]);
      if (mode === 'full') assert.equal(Object.values(a.s.world().state.containers).filter(x => x === nest).length, 8);
      if (stage === 'fallback') {
        a.invoke('take', [a.coin]); a.invoke('drop', [a.coin]); a.elapsed(43500);
        assert.equal(a.s.world().state.containers[a.coin], a.s.world().roomIds[`${prefix}:room/village_green`]);
        assert.equal(Object.values(a.s.world().state.crows ?? {}).some(r => r.phase === 'leg'), false);
      }
      cold(a, path);
    } finally { if (a.p.sql.isOpen) a.p.sql.close(); rmSync(dir, { recursive: true }); }
  }
}
for (const action of ['attack', 'flee', 'shoo', 'close', 'take', 'put'] as const) {
  for (const kind of ['failed', 'lost'] as const) {
    const dir = mkdtempSync(join(tmpdir(), 'loka-crow-p4-fault-')); const path = join(dir, 'save.db');
    const nestAction = ['close', 'take', 'put'].includes(action);
    const a = setup(path, c => { if (nestAction) c.entry = ref('room', 'oak_branches'); }, 'fen_born');
    try {
      let target: string[];
      if (nestAction) {
        const nest = entity(a.s.world(), 'item', 'crow_nest');
        if (action === 'put') {
          a.invoke('move', [], { direction: 'down' }); a.invoke('move', [], { direction: 'north' });
          const root = entity(a.s.world(), 'item', 'fenwort_01'); a.invoke('take', [root]);
          a.invoke('move', [], { direction: 'south' }); a.invoke('move', [], { direction: 'up' }); target = [root, nest];
        } else target = [nest];
      } else {
        a.invoke('take', [a.coin]); a.invoke('drop', [a.coin]); a.elapsed(43500);
        const row = Object.values(a.s.world().state.crows ?? {}).find(r => r.phase === 'leg')!;
        a.invoke('move', [], { direction: 'south' });
        if (action === 'flee') { a.invoke('attack', [row.member_id]); target = []; } else target = [row.member_id];
      }
      faultInvoke(a, kind, action, target);
      if (action === 'attack' || action === 'flee' || action === 'shoo') {
        assert.equal(a.s.world().state.containers[a.coin], a.s.world().roomIds[`${prefix}:room/well_lane`]);
        assert.equal(Object.values(a.s.world().state.crows ?? {}).find(r => r.phase !== 'idle')?.phase, action === 'attack' ? 'paused_return' : 'return');
      }
      cold(a, path);
    } finally { if (a.p.sql.isOpen) a.p.sql.close(); rmSync(dir, { recursive: true }); }
  }
}
for (const mode of ['death', 'replacement', 'newdrop'] as const) {
  for (const kind of (mode === 'death' ? ['none'] : ['failed', 'lost']) as ('none' | 'failed' | 'lost')[]) {
    const dir = mkdtempSync(join(tmpdir(), 'loka-crow-replacement-')); const path = join(dir, 'save.db');
    const a = setup(path);
    try {
      a.invoke('take', [a.coin]); a.invoke('drop', [a.coin]); a.elapsed(43650);
      const old = Object.values(a.s.world().state.crows ?? {}).find(r => r.phase === 'leg')!;
      a.invoke('move', [], { direction: 'south' }); a.invoke('move', [], { direction: 'south' }); a.invoke('attack', [old.member_id]);
      let entry = Object.entries(a.s.world().state.population_slots ?? {}).find(([,r]) => r.member_id === old.member_id)!;
      for (let i = 0; i < 20 && entry[1].replacement_due === null; i++) {
        a.elapsed(a.s.world().state.clock + 150);
        entry = Object.entries(a.s.world().state.population_slots ?? {}).find(([,r]) => r.member_id === old.member_id)!;
      }
      assert.notEqual(entry[1].replacement_due, null);
      if (mode !== 'death') {
        a.invoke('take', [a.coin]); a.invoke('move', [], { direction: 'north' }); a.invoke('move', [], { direction: 'north' });
        const due = entry[1].replacement_due!; a.elapsed(due - 1);
        const evidence = { expected_run_id: a.s.runId(), from: due - 1, until: due };
        const before = encode(a.s.world().state as never);
        if (kind === 'failed') a.p.sql.exec('PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)');
        a.p.fault.kind = kind as 'failed' | 'lost'; a.p.fault.armed = true;
        assert.equal(a.s.elapsed(evidence).kind, 'pending'); assert.equal(encode(a.s.world().state as never), before); a.p.fault.reads = false;
        const saved = a.s.elapsed(evidence); assert.equal(saved.kind, 'saved');
        if (saved.kind === 'saved') assert.equal(saved.replay, kind === 'lost');
        const rows = a.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
        const replay = a.s.elapsed(evidence); assert.equal(replay.kind, 'saved');
        if (replay.kind === 'saved') assert.equal(replay.replay, true);
        assert.deepEqual(a.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(), rows); faults++;
        const replacement = a.s.world().state.population_slots![entry[0]];
        assert.equal(replacement.generation, 2); assert.notEqual(replacement.member_id, old.member_id); assert.equal(replacement.replacement_due, null);
        assert.equal(a.s.world().state.containers[a.coin], a.s.world().body);
        if (mode === 'newdrop') {
          const room = a.s.world().state.containers[replacement.member_id];
          if (room === a.s.world().roomIds[`${prefix}:room/well_lane`]) a.invoke('move', [], { direction: 'south' });
          assert.equal(a.s.world().state.containers[a.s.world().body], room);
          // Each operation fault helper needs fresh constraint tables and unique invocation IDs.
          if (kind === 'failed') a.p.sql.exec('DROP TABLE child; DROP TABLE parent');
          a.p.fault.inserted = false;
          faultInvoke(a, kind as 'failed' | 'lost', 'drop', [a.coin]);
          const row = Object.values(a.s.world().state.crows ?? {}).find(r => r.phase === 'acquire')!;
          assert.equal(row.member_id, replacement.member_id); assert.equal(row.generation, 2); assert.equal(row.item_id, a.coin);
        }
      }
      cold(a, path);
    } finally { if (a.p.sql.isOpen) a.p.sql.close(); rmSync(dir, { recursive: true }); }
  }
}
for (const kind of ['failed', 'lost'] as const) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-crow-death-fault-')); const path = join(dir, 'save.db'); const a = setup(path);
  try {
    a.invoke('take', [a.coin]); a.invoke('drop', [a.coin]); a.elapsed(43650);
    const crow = Object.values(a.s.world().state.crows ?? {}).find(r => r.phase === 'leg')!;
    a.invoke('move', [], { direction: 'south' }); a.invoke('move', [], { direction: 'south' }); a.invoke('attack', [crow.member_id]);
    if (kind === 'failed') a.p.sql.exec('PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)');
    for (let i = 0; i < 20; i++) {
      const slot = Object.values(a.s.world().state.population_slots ?? {}).find(r => r.member_id === crow.member_id)!;
      if (slot.replacement_due !== null) break;
      const from = a.s.world().state.clock; const evidence = { expected_run_id: a.s.runId(), from, until: from + 150 };
      const before = encode(a.s.world().state as never); const rows = a.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
      a.p.fault.kind = kind; a.p.fault.armed = true; a.p.fault.inserted = false;
      assert.equal(a.s.elapsed(evidence).kind, 'pending'); assert.equal(encode(a.s.world().state as never), before); a.p.fault.reads = false;
      if (kind === 'failed') assert.deepEqual(a.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(), rows);
      const saved = a.s.elapsed(evidence); assert.equal(saved.kind, 'saved'); if (saved.kind === 'saved') assert.equal(saved.replay, kind === 'lost');
      const after = a.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(); const replay = a.s.elapsed(evidence); assert.equal(replay.kind, 'saved'); if (replay.kind === 'saved') assert.equal(replay.replay, true);
      assert.deepEqual(a.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(), after); faults++;
    }
    assert.notEqual(Object.values(a.s.world().state.population_slots ?? {}).find(r => r.member_id === crow.member_id)!.replacement_due, null);
    assert.equal(a.s.world().state.containers[a.coin], a.s.world().roomIds[`${prefix}:room/ferry_landing`]);
    cold(a, path);
  } finally { if (a.p.sql.isOpen) a.p.sql.close(); rmSync(dir, { recursive: true }); }
}
console.log(JSON.stringify({ reopens, faults, owner_save_access: false }));
