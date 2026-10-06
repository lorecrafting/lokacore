// Real SQLite verifies liquid row provenance across lawful later custody and uncertain commits.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import type { DefinitionRef } from '../../../kernel/ts/src/contracts.gen.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';

const production = read('protocol/fixtures/missing_child_b7_hash.json');
const water = {
  cartridge_id: 'ashmere_missing_child',
  cartridge_version: production.value.manifest.version,
  kind: 'liquid',
  key: 'water',
} as DefinitionRef;
const empty = { kind: null, quantity: 0 };
const wet = (quantity: number) => ({ kind: water, quantity });

function setup(bundle = production, path = ':memory:') {
  const loaded = loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({
        cartridge: bundle.value,
        content_hash: bundle.sha256,
      }),
    ),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const fresh = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  let p = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const releases = [{ fresh, content_hash: bundle.sha256 }] as const;
  const open = () => {
    const result = openStory(p.db, releases, p.host);
    assert.equal(result.kind, 'open', JSON.stringify(result));
    if (result.kind !== 'open') throw new Error('liquid save');
    return result;
  };
  let story = open(),
    ordinal = 0;
  const entity = (kind: string, key: string) =>
    fresh.entityIds[`ashmere_missing_child@0.0.22:${kind}/${key}`];
  const attempt = (action_key: string, target_ids: string[] = [], input: object = {}) => ({
    invocation_id: `cccccccc-0000-4000-8000-${String(++ordinal).padStart(12, '0')}`,
    actor_id: fresh.character,
    action_key,
    target_ids,
    input,
  });
  const invoke = (action: string, ids: string[] = [], input: object = {}) => {
    const result = story.invoke(attempt(action, ids, input));
    assert.equal(result.kind, 'saved', JSON.stringify(result));
    if (result.kind === 'saved')
      assert.equal((result.decision as any).kind, 'accepted', JSON.stringify(result));
    return result;
  };
  return {
    fresh,
    releases,
    entity,
    attempt,
    invoke,
    get sql() {
      return p.sql;
    },
    get db() {
      return p.db;
    },
    get fault() {
      return p.fault;
    },
    story: () => story,
    reopen: () => {
      if (path !== ':memory:') {
        p.sql.close();
        p = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
      }
      story = open();
    },
    refuse: () => openStory(p.db, releases, p.host),
    move: (...directions: string[]) =>
      directions.forEach((direction) => invoke('move', [], { direction })),
    well: Object.entries(fresh.details).find(([, detail]) => detail.liquid_source)![0],
  };
}

function skins(a: ReturnType<typeof setup>) {
  return ['waterskin', 'spare_waterskin'].map((key) => a.entity('item', key));
}
function buySkins(a: ReturnType<typeof setup>) {
  a.move('north', 'west');
  for (const skin of skins(a)) a.invoke('buy', [a.entity('npc', 'peg'), skin], { quoted_price: 4 });
  a.move('east');
}
function rows(a: ReturnType<typeof setup>) {
  return skins(a).map((id) => a.story().world().state.liquids![id]);
}
const disk = (a: ReturnType<typeof setup>) =>
  ['state_row', 'head', 'receipt'].map((table) =>
    a.sql.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all(),
  );

// Breaks: reopening restores only final contents, resets shells or imposes current custody on old Fill.
test('production empty, filled, partial Pour, empty, nested, ground and shop custody reopen exactly', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-liquid-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db'),
    a = setup(production, path);
  const [original, spare] = skins(a),
    peg = a.entity('npc', 'peg');
  a.reopen();
  assert.deepEqual(rows(a), [empty, empty]);
  buySkins(a);
  a.reopen();
  assert.deepEqual(rows(a), [empty, empty]);
  const fill = a.attempt('fill', [a.well, original]);
  assert.equal(a.story().invoke(fill).kind, 'saved');
  a.reopen();
  assert.deepEqual(rows(a), [wet(4), empty]);
  const fillReplay = a.story().invoke(fill);
  assert.equal(fillReplay.kind === 'saved' && fillReplay.replay, true);
  assert.deepEqual(rows(a), [wet(4), empty]);
  a.invoke('fill', [a.well, spare]);
  a.reopen();
  assert.deepEqual(rows(a), [wet(4), wet(4)]);
  const drink = a.attempt('drink', [spare]);
  assert.equal(a.story().invoke(drink).kind, 'saved');
  a.reopen();
  assert.deepEqual(rows(a), [wet(4), wet(3)]);
  const drinkReplay = a.story().invoke(drink);
  assert.equal(drinkReplay.kind === 'saved' && drinkReplay.replay, true);
  assert.deepEqual(rows(a), [wet(4), wet(3)]);
  a.invoke('pour', [original, spare]);
  a.reopen();
  assert.deepEqual(rows(a), [wet(3), wet(4)]);
  for (let n = 2; n >= 0; n--) {
    a.invoke('drink', [original]);
    a.reopen();
    assert.deepEqual(rows(a), [n ? wet(n) : empty, wet(4)]);
  }
  a.move('west');
  const satchel = a.entity('item', 'satchel');
  a.invoke('buy', [peg, satchel], { quoted_price: 5 });
  a.invoke('put', [spare, satchel]);
  a.reopen();
  assert.equal(a.story().world().state.containers[spare], satchel);
  a.invoke('drink', [spare]);
  a.reopen();
  assert.deepEqual(rows(a), [empty, wet(3)]);
  a.invoke('take', [spare]);
  a.invoke('drop', [spare]);
  a.reopen();
  assert.equal(
    a.story().world().state.containers[spare],
    a.story().world().state.containers[a.fresh.body],
  );
  a.invoke('take', [spare]);
  a.invoke('sell', [peg, spare], { quoted_price: 2 });
  a.reopen();
  assert.equal(a.story().world().state.containers[spare], peg);
  a.invoke('buy', [peg, spare], { quoted_price: 4 });
  a.reopen();
  assert.deepEqual(rows(a), [empty, wet(3)]);
  const expected = a.story().world().state;
  a.sql.close();
  const cold = setup(production, path);
  t.after(() => cold.sql.close());
  assert.deepEqual(cold.story().world().state, expected);
});

// Breaks: shape-valid quantity or malformed vessel rows reopen without their actual transition proof.
test('cold open refuses missing, extra, malformed and plausible bounded liquid rows without repair', () => {
  for (const mutation of [
    'missing',
    'extra',
    'kind',
    'negative',
    'fraction',
    'overflow',
    'null',
    'bounded',
  ]) {
    const a = setup();
    try {
      buySkins(a);
      const [skin] = skins(a);
      a.invoke('fill', [a.well, skin]);
      a.invoke('look');
      if (mutation === 'missing')
        a.sql.prepare("DELETE FROM state_row WHERE section='liquids' AND key=?").run(skin);
      else if (mutation === 'extra')
        a.sql
          .prepare('INSERT INTO state_row VALUES (?,?,?)')
          .run('liquids', a.fresh.body, JSON.stringify(empty));
      else {
        const quantity = { kind: 1, negative: -1, fraction: 1.5, overflow: 5, null: 1, bounded: 3 }[
          mutation
        ]!;
        const kind =
          mutation === 'null' ? null : mutation === 'kind' ? { ...water, key: 'oil' } : water;
        a.sql
          .prepare("UPDATE state_row SET value=? WHERE section='liquids' AND key=?")
          .run(JSON.stringify({ kind, quantity }), skin);
      }
      const before = disk(a);
      assert.equal(a.refuse().kind, 'save_corrupt', mutation);
      assert.deepEqual(disk(a), before);
    } finally {
      a.sql.close();
    }
  }
});

// Breaks: bounded current rows mask forged earlier command, causal event, custody or finite debit evidence.
test('cold open binds every liquid receipt to its historical command, source and complete ordered rows', () => {
  for (const mutation of [
    'source',
    'actor',
    'vessel',
    'command-id',
    'cause',
    'correlation',
    'event-actor',
    'event-source',
    'prior',
    'result',
    'debit',
    'order',
  ]) {
    const a = setup();
    try {
      buySkins(a);
      const [original, spare] = skins(a);
      a.invoke('fill', [a.well, original]);
      a.invoke('fill', [a.well, spare]);
      a.invoke('drink', [spare]);
      a.invoke('pour', [original, spare]);
      a.invoke('look');
      const type = ['debit', 'order'].includes(mutation) ? 'pour' : 'fill';
      const row = a.sql
        .prepare(
          "SELECT invocation_id,command,response FROM receipt WHERE json_extract(command,'$.payload.type')=? ORDER BY revision LIMIT 1",
        )
        .get(type)!;
      const command = JSON.parse(row.command as string),
        decision = JSON.parse(row.response as string);
      if (mutation === 'source') command.payload.source_id = a.entity('npc', 'peg');
      if (mutation === 'actor') command.payload.actor_id = a.fresh.body;
      if (mutation === 'vessel') command.payload.vessel_id = spare;
      if (mutation === 'command-id') command.id = a.fresh.body;
      if (mutation === 'cause') decision.events[0].causation_id = a.fresh.body;
      if (mutation === 'correlation') decision.events[0].correlation_id = a.fresh.body;
      if (mutation === 'event-actor') decision.events[0].actor_id = a.fresh.body;
      if (mutation === 'event-source')
        decision.events[0].payload.source_id = a.entity('npc', 'peg');
      if (mutation === 'prior') decision.delta.ops[0].from = wet(1);
      if (mutation === 'result') decision.delta.ops[0].to = wet(3);
      if (mutation === 'debit') decision.delta.ops.shift();
      if (mutation === 'order') decision.delta.ops.reverse();
      a.sql
        .prepare('UPDATE receipt SET command=?,response=? WHERE invocation_id=?')
        .run(JSON.stringify(command), JSON.stringify(decision), row.invocation_id as string);
      const before = disk(a);
      assert.equal(a.refuse().kind, 'save_corrupt', mutation);
      assert.deepEqual(disk(a), before);
    } finally {
      a.sql.close();
    }
  }
});

// Breaks: unknown Pour adopts early, loses one row or exact retry applies its finite debit twice.
test('Pour failed COMMIT and lost acknowledgement fence liquid then reconcile and replay once', () => {
  for (const kind of ['failed', 'lost'] as const) {
    const a = setup(
      controlledBundle((value) => {
        value.items['ashmere_missing_child@0.0.22:item/waterskin'].vessel = {
          capacity: 5,
          unit_label: 'liquid.units',
          initial: wet(5),
        };
        value.items['ashmere_missing_child@0.0.22:item/spare_waterskin'].vessel = {
          capacity: 7,
          unit_label: 'liquid.units',
          initial: wet(4),
        };
      }),
    );
    try {
      buySkins(a);
      const [original, spare] = skins(a);
      const before = disk(a),
        old = a.story().world();
      a.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
      a.fault.kind = kind;
      a.fault.armed = true;
      const attempt = a.attempt('pour', [original, spare]);
      assert.equal(a.story().invoke(attempt).kind, 'pending');
      assert.equal(a.story().world(), old);
      assert.equal(a.story().invoke(a.attempt('drink', [spare])).kind, 'pending');
      assert.equal(
        a.story().elapsed({
          expected_run_id: a.story().runId(),
          from: old.state.clock,
          until: old.state.clock + 1,
        }).kind,
        'pending',
      );
      a.fault.reads = false;
      if (a.sql.isTransaction) a.sql.exec('ROLLBACK');
      a.reopen();
      assert.deepEqual(rows(a), kind === 'lost' ? [wet(2), wet(7)] : [wet(5), wet(4)]);
      if (kind === 'failed') assert.deepEqual(disk(a), before);
      const retry = a.story().invoke(attempt);
      assert.equal(retry.kind, 'saved');
      if (retry.kind === 'saved') assert.equal(retry.replay, kind === 'lost');
      a.reopen();
      assert.deepEqual(rows(a), [wet(2), wet(7)]);
      const committed = disk(a),
        again = a.story().invoke(attempt);
      assert.equal(again.kind === 'saved' && again.replay, true);
      assert.deepEqual(disk(a), committed);
    } finally {
      a.sql.close();
    }
  }
});

function controlledBundle(change: (value: any) => void) {
  const value = structuredClone(production.value);
  change(value);
  const canonical = encode(value);
  return { value, canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
}

// Breaks: death drops liquid rows or historical owner checks reject valid corpse/recovered custody.
test('actual fatal combat cold reopens the filled shell on its corpse then ordinary recovery', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-liquid-death-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const a = setup(
    controlledBundle((value) => {
      value.resources['ashmere_missing_child@0.0.22:resource/hp'].start = 1;
      value.npcs['ashmere_missing_child@0.0.22:npc/cellar_rat_1'].attack = {
        chance: 100,
        damage_min: 10,
        damage_max: 10,
      };
      value.world.combat.player_attack.chance = 0;
    }),
    join(dir, 'save.db'),
  );
  try {
    buySkins(a);
    const [skin] = skins(a);
    a.invoke('fill', [a.well, skin]);
    a.move('east', 'down');
    a.invoke('attack', [a.entity('npc', 'cellar_rat_1')]);
    const from = a.story().world().state.clock;
    const fatal = a
      .story()
      .elapsed({ expected_run_id: a.story().runId(), from, until: from + 150 });
    assert.equal(fatal.kind, 'saved', JSON.stringify(fatal));
    a.reopen();
    const corpse = Object.keys(a.story().world().state.created!)[0];
    assert.ok(corpse);
    assert.equal(a.story().world().state.containers[skin], corpse);
    assert.deepEqual(rows(a), [wet(4), empty]);
    a.move('south', 'south', 'south', 'south', 'east', 'down');
    a.invoke('take', [skin]);
    a.reopen();
    assert.equal(a.story().world().state.containers[skin], a.fresh.body);
    assert.deepEqual(rows(a), [wet(4), empty]);
    a.invoke('drink', [skin]);
    a.reopen();
    assert.deepEqual(rows(a), [wet(3), empty]);
  } finally {
    a.sql.close();
  }
});
// Breaks: a consistently rewritten command and event identity evades the stored invocation binding.
test('cold open rejects consistent command/event rewrites that cannot derive from the original invocation', () => {
  const a = setup();
  try {
    buySkins(a);
    const [original] = skins(a);
    a.invoke('fill', [a.well, original]);
    const row = a.sql
      .prepare(
        "SELECT invocation_id,command,response FROM receipt WHERE json_extract(command,'$.payload.type')='fill'",
      )
      .get()!;
    const command = JSON.parse(row.command as string),
      decision = JSON.parse(row.response as string);
    // Independent SHA-256/UUID answer for [loka-id-v1, fixed context, this forged command, 0].
    const forged = 'dddddddd-0000-4000-8000-000000009999';
    command.id = forged;
    decision.events[0].id = '689a81a1-db31-8424-aca5-368536dbd152';
    decision.events[0].causation_id = forged;
    decision.events[0].correlation_id = forged;
    a.sql
      .prepare('UPDATE receipt SET command_id=?,command=?,response=? WHERE invocation_id=?')
      .run(forged, JSON.stringify(command), JSON.stringify(decision), row.invocation_id);
    const before = disk(a);
    assert.equal(a.refuse().kind, 'save_corrupt');
    assert.deepEqual(disk(a), before);
  } finally {
    a.sql.close();
  }
});
