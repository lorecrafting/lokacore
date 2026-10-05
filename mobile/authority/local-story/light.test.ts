import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  bundle,
  fresh,
  entity,
  npc,
  room,
  lethalLightFixture,
  lightOnlyFixture,
} from '../../../kernel/ts/test/light_fixture.ts';
import { fuelView } from '../../../kernel/ts/src/mechanics/light/shared.ts';
import { key } from '../../../kernel/ts/src/foundation/compose.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
const releases = [{ fresh, content_hash: bundle.sha256 }] as const;
const torch = entity('torch'),
  oil = entity('lamp_oil'),
  bag = entity('satchel'),
  peg = npc('peg');
function setup(path = ':memory:', supplied = { bundle, fresh }) {
  const releases = [{ fresh: supplied.fresh, content_hash: supplied.bundle.sha256 }] as const;
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, supplied.bundle);
  let story = openStory(p.db, releases, p.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') throw new Error('open');
  let current = story,
    n = Number(p.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n);
  const invocation = (action_key: string, target_ids: string[] = [], input: object = {}) => ({
    invocation_id: `dddddddd-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    actor_id: fresh.character,
    action_key,
    target_ids,
    input,
  });
  const invoke = (verb: string, targets: string[] = [], input: object = {}) => {
    const r = current.invoke(invocation(verb, targets, input));
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved') assert.equal((r.decision as any).kind, 'accepted', JSON.stringify(r));
    return r;
  };
  const move = (...dirs: string[]) =>
    dirs.forEach((direction) => invoke('move', [], { direction }));
  const reopen = () => {
    const r = openStory(p.db, releases, p.host);
    assert.equal(r.kind, 'open', JSON.stringify(r));
    if (r.kind !== 'open') throw new Error('reopen');
    current = r;
  };
  const elapsed = (amount: number) => {
    const from = current.world().state.clock;
    const r = current.elapsed({ expected_run_id: current.runId(), from, until: from + amount });
    assert.equal(r.kind, 'saved', JSON.stringify(r));
  };
  const buy = () => {
    move('north', 'west');
    invoke('buy', [peg, torch], { quoted_price: 3 });
    invoke('buy', [peg, oil], { quoted_price: 2 });
  };
  return {
    ...p,
    invocation,
    invoke,
    move,
    reopen,
    elapsed,
    buy,
    story: () => current,
    world: () => current.world(),
  };
}
const disk = (p: ReturnType<typeof setup>) =>
  ['state_row', 'head', 'receipt', 'elapsed'].map((t) =>
    p.sql.prepare(`SELECT * FROM ${t} ORDER BY 1,2`).all(),
  );
// Break: current save reopen restarts a torch, loses oil, or commerce refills the same item.
test('actual torch oil and nested intervals survive cold reopen and sell/buyback with conserved pennies', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-light-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db'),
    p = setup(path);
  p.buy();
  const penny = Object.values(fresh.cartridge.resources!).find((r) => r.key === 'pennies')!;
  const resource = {
    cartridge_id: fresh.cartridge.manifest.id,
    cartridge_version: fresh.cartridge.manifest.version,
    kind: 'resource',
    key: penny.key,
  };
  assert.deepEqual(
    [fresh.body, peg, npc('aldric')].map(
      (entity_id) =>
        p.world().state.resources![key({ kind: 'resource', resource, entity_id })].value,
    ),
    [15, 25, 10],
  );
  p.reopen();
  p.invoke('buy', [peg, bag], { quoted_price: 5 });
  p.invoke('ignite', [torch]);
  p.elapsed(3);
  p.reopen();
  assert.deepEqual(fuelView(p.world(), torch), { remaining: 7197, capacity: 7200, lit: true });
  p.invoke('douse', [torch]);
  p.elapsed(7);
  p.reopen();
  assert.equal(fuelView(p.world(), torch)!.remaining, 7197);
  p.invoke('refuel', [torch, oil]);
  p.reopen();
  assert.equal(p.world().state.fuel![oil].remaining, 7197);
  p.invoke('ignite', [torch]);
  p.invoke('sell', [peg, torch], { quoted_price: 1 });
  p.elapsed(2);
  p.reopen();
  p.invoke('buy', [peg, torch], { quoted_price: 3 });
  p.invoke('put', [torch, bag]);
  p.elapsed(2);
  p.reopen();
  p.invoke('take', [torch]);
  assert.equal(fuelView(p.world(), torch)!.remaining, 7196);
  p.sql.close();
  const q = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  t.after(() => q.sql.close());
  const r = openStory(q.db, releases, q.host);
  assert.equal(r.kind, 'open', JSON.stringify(r));
  if (r.kind === 'open') assert.equal(fuelView(r.world(), torch)!.remaining, 7196);
});
// Break: a failed/unknown refill COMMIT publishes one row, or receipt replay debits oil twice.
test('real failed and unknown refill commits reconcile the entire writer group and exact retry', () => {
  for (const kind of ['failed', 'lost'] as const) {
    const p = setup();
    try {
      p.buy();
      p.invoke('ignite', [torch]);
      p.elapsed(3);
      p.invoke('douse', [torch]);
      const before = disk(p),
        attempt = p.invocation('refuel', [torch, oil]);
      p.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
      p.fault.kind = kind;
      p.fault.armed = true;
      assert.deepEqual(p.story().invoke(attempt), { kind: 'pending' });
      p.fault.reads = false;
      if (kind === 'failed') assert.deepEqual(disk(p), before);
      if (kind === 'lost')
        assert.deepEqual(
          [p.world().state.fuel![torch].remaining, p.world().state.fuel![oil].remaining],
          [7197, 7200],
        );
      const r = p.story().invoke(attempt);
      assert.equal(r.kind, 'saved', JSON.stringify(r));
      assert.equal(p.world().state.fuel![torch].remaining, 7200);
      assert.equal(p.world().state.fuel![oil].remaining, 7197);
      p.reopen();
      const rows = disk(p);
      p.story().invoke(attempt);
      assert.deepEqual(disk(p), rows);
    } finally {
      p.sql.close();
    }
  }
});
// Break: bounded fuel forgery/missing debit or future/malformed stored row is mistaken for lawful history.
test('corrupt fuel and forged refills refuse without repairing SQLite', () => {
  const mutations = [
    (p: ReturnType<typeof setup>) =>
      p.sql.prepare("DELETE FROM state_row WHERE section='fuel' AND key=?").run(torch),
    (p: ReturnType<typeof setup>) =>
      p.sql
        .prepare(
          "UPDATE state_row SET value=json_set(value,'$.at',999999) WHERE section='fuel' AND key=?",
        )
        .run(torch),
    (p: ReturnType<typeof setup>) =>
      p.sql
        .prepare(
          "UPDATE state_row SET value=json_set(value,'$.remaining',7201) WHERE section='fuel' AND key=?",
        )
        .run(torch),
    (p: ReturnType<typeof setup>) =>
      p.sql
        .prepare(
          "UPDATE state_row SET value=json_set(value,'$.remaining',7000) WHERE section='fuel' AND key=?",
        )
        .run(torch),
    (p: ReturnType<typeof setup>) =>
      p.sql
        .prepare(
          "UPDATE state_row SET value=json_set(value,'$.lit',1) WHERE section='fuel' AND key=?",
        )
        .run(torch),
    (p: ReturnType<typeof setup>) => {
      const r = p.sql
        .prepare(
          "SELECT invocation_id,response FROM receipt WHERE json_extract(command,'$.payload.type')='refuel'",
        )
        .get()!;
      const d = JSON.parse(r.response as string);
      d.delta.ops.pop();
      p.sql
        .prepare('UPDATE receipt SET response=? WHERE invocation_id=?')
        .run(JSON.stringify(d), r.invocation_id as string);
    },
  ];
  for (const corrupt of mutations) {
    const p = setup();
    try {
      p.buy();
      p.invoke('ignite', [torch]);
      p.elapsed(3);
      p.invoke('douse', [torch]);
      p.invoke('refuel', [torch, oil]);
      corrupt(p);
      const before = disk(p);
      assert.equal(openStory(p.db, releases, p.host).kind, 'save_corrupt');
      assert.deepEqual(disk(p), before);
    } finally {
      p.sql.close();
    }
  }
});
import { gameView } from '../../../kernel/ts/src/index.ts';
// Break: the real fatal clock/corpse rows fail cold recovery, or loss of the sole light blocks its roots.
test('dark lethal combat cold reopens and permits the gear-free owner corpse walk and exact recovery', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-light-corpse-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const supplied = lethalLightFixture(),
    path = join(dir, 'save.db'),
    p = setup(path, supplied);
  p.buy();
  p.invoke('buy', [peg, bag], { quoted_price: 5 });
  p.invoke('put', [oil, bag]);
  p.invoke('ignite', [torch]);
  p.move('east', 'down');
  p.invoke('attack', [npc('cellar_rat_1')]);
  p.elapsed(150);
  const dead = p.world(),
    corpse = Object.keys(dead.state.created!)[0];
  assert.equal(dead.state.containers[dead.body], room('chapel_nave'));
  assert.deepEqual(
    [dead.state.containers[torch], dead.state.containers[bag], dead.state.containers[oil]],
    [corpse, corpse, bag],
  );
  p.sql.close();
  const q = setup(path, supplied);
  t.after(() => q.sql.close());
  q.move('south', 'south', 'south', 'south', 'down');
  assert.equal(gameView(q.world()).place.description.key, 'room.well_shaft.dark');
  assert.deepEqual(
    gameView(q.world()).entities.map((e) => e.id),
    [corpse],
  );
  q.invoke('look', [corpse]);
  q.invoke('take', [bag]);
  q.reopen();
  assert.deepEqual(
    [q.world().state.containers[bag], q.world().state.containers[oil]],
    [fresh.body, bag],
  );
  q.invoke('take', [torch]);
  q.reopen();
  assert.equal(q.world().state.containers[torch], fresh.body);
  assert.equal(fuelView(q.world(), torch)!.remaining, 7050);
  q.invoke('attack', [npc('cellar_rat_1')]);
  q.elapsed(150);
  q.reopen();
  assert.equal(Object.keys(q.world().state.created!).length, 2);
  assert.equal(q.world().state.containers[corpse], room('well_shaft'));
  assert.notEqual(q.world().state.containers[torch], corpse);
});
// Break: receipt history validates fuel only when an unrelated repeated-exchange quest is installed.
test('a light-only cartridge reopens lawful refill history and rejects a bounded forged charge', () => {
  const supplied = lightOnlyFixture(),
    p = setup(':memory:', supplied);
  try {
    const source = supplied.fresh.entityIds['ashmere_items@0.0.1:item/lantern'];
    const supply = supplied.fresh.entityIds['ashmere_items@0.0.1:item/lamp_oil'];
    p.invoke('take', [supply]);
    p.move('north');
    p.invoke('take', [source]);
    p.invoke('refuel', [source, supply]);
    p.reopen();
    assert.deepEqual(p.world().state.fuel, {
      [source]: { remaining: 8, at: 100, lit: false },
      [supply]: { remaining: 0, at: 100, lit: false },
    });
    p.sql
      .prepare(
        "UPDATE state_row SET value=json_set(value,'$.remaining',7) WHERE section='fuel' AND key=?",
      )
      .run(source);
    const before = disk(p);
    assert.equal(
      openStory(p.db, [{ fresh: supplied.fresh, content_hash: supplied.bundle.sha256 }], p.host)
        .kind,
      'save_corrupt',
    );
    assert.deepEqual(disk(p), before);
  } finally {
    p.sql.close();
  }
});
