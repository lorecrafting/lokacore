// Immediate service integration uses real rollback-journal SQLite and the installed receipt history verifier.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import type { Db } from './store.ts';
import { test } from 'node:test';
import {
  bundle,
  fresh,
  prefix,
  ref,
  entity,
  amounts,
  stock,
  mv,
  ale,
  resourceKey,
} from '../../../kernel/ts/test/service_fixture.ts';
import { openStory } from './authority.ts';
import { openGame } from './session.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { presenter } from '../../app/book/presenter.ts';
import { group, intentOf, pagesAfter } from '../../app/book/model.ts';

function setup(path = ':memory:', change: (c: any) => void = () => {}) {
  const b = bundle(change),
    initial = fresh(change);
  let p = elapsedHost(path, { wall: 10000, mono: 0 }, b),
    n = 0;
  const releases = [{ fresh: initial, content_hash: b.sha256 }] as const;
  const open = () => {
    const s = openStory(p.db, releases, p.host);
    assert.equal(s.kind, 'open', JSON.stringify(s));
    if (s.kind !== 'open') throw new Error('service save');
    return s;
  };
  let story = open();
  const attempt = (name: string) => {
    const s = initial.cartridge.services![`${prefix}:service/${name}`];
    return {
      invocation_id: `cccccccc-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      actor_id: initial.character,
      action_key: s.action,
      target_ids: [entity(initial, 'npc', 'maud')],
      input: { service: ref('service', name), quoted_price: s.price },
    };
  };
  const invoke = (name: string) => {
    const i = attempt(name),
      r = story.invoke(i);
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved') assert.equal((r.decision as any).kind, 'accepted', JSON.stringify(r));
    return i;
  };
  return {
    initial,
    releases,
    b,
    attempt,
    invoke,
    get story() {
      return story;
    },
    get sql() {
      return p.sql;
    },
    get db() {
      return p.db;
    },
    get fault() {
      return p.fault;
    },
    get host() {
      return p.host;
    },
    get game() {
      return p.game;
    },
    reopen() {
      if (path !== ':memory:') {
        p.sql.close();
        p = elapsedHost(path, { wall: 10000, mono: 0 }, b);
      }
      story = open();
    },
    refuse: () => openStory(p.db, releases, p.host),
  };
}
const disk = (a: ReturnType<typeof setup>) =>
  ['state_row', 'head', 'receipt'].map((t) =>
    a.sql.prepare(`SELECT * FROM ${t} ORDER BY 1,2`).all(),
  );
const truth = (a: ReturnType<typeof setup>) => ({
  money: amounts(a.story.world()),
  stock: stock(a.story.world()),
  ale: ale(a.story.world()).quantity,
  mv: mv(a.story.world()),
});
const expected = { money: [14, 16], stock: 3, ale: 3, mv: 66 };

// Breaks: service save reinitializes finite stock or fails to recognize a new conserved-penny/liquid producer.
test('room-before-Rest, meal, partial/empty ale reopen and exact retries preserve the next real consumer', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-service-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const a = setup(join(dir, 'save.db'));
  t.after(() => a.sql.close());
  a.reopen();
  const room = a.invoke('lantern_room');
  a.reopen();
  assert.deepEqual(truth(a), { money: [17, 13], stock: 4, ale: 4, mv: 50 });
  assert.equal(a.story.invoke(room).kind, 'saved');
  assert.deepEqual(truth(a), { money: [17, 13], stock: 4, ale: 4, mv: 50 });
  const meal = a.invoke('lantern_meal');
  a.reopen();
  assert.deepEqual(truth(a), { money: [15, 15], stock: 3, ale: 4, mv: 62 });
  a.invoke('lantern_ale');
  a.reopen();
  assert.deepEqual(truth(a), expected);
  a.story.invoke(meal);
  assert.deepEqual(truth(a), expected);
  for (let i = 0; i < 3; i++) {
    a.invoke('lantern_ale');
    a.reopen();
  }
  assert.deepEqual(ale(a.story.world()), { kind: null, quantity: 0 });
  assert.equal(a.story.invoke(a.attempt('lantern_ale')).kind, 'saved');
  const move = (direction: string) =>
    a.story.invoke({
      invocation_id: `dddddddd-0000-4000-8000-${String(direction === 'up' ? 1 : 2).padStart(12, '0')}`,
      actor_id: a.initial.character,
      action_key: 'move',
      target_ids: [],
      input: { direction },
    });
  assert.equal(move('up').kind, 'saved');
  a.reopen();
  const rest = a.story.invoke({
    invocation_id: 'dddddddd-0000-4000-8000-000000000003',
    actor_id: a.initial.character,
    action_key: 'rest',
    target_ids: [],
    input: {},
  });
  assert.equal(rest.kind === 'saved' && (rest.decision as any).kind, 'accepted');
  a.reopen();
  assert.equal(
    a.story.world().state.containers[a.initial.body],
    a.initial.roomIds[`${prefix}:room/inn_rooms`],
  );
});

// Breaks: bounded forged entitlement/stock/ale or altered service/payment/benefit receipts pass current-value checks.
test('forged bounded service rows and swapped/omitted historical service evidence refuse without repair', (t) => {
  for (const mutation of [
    'entitlement',
    'meals',
    'ale',
    'service',
    'provider',
    'quote',
    'payment',
    'stock',
    'benefit',
  ]) {
    const a = setup();
    try {
      a.invoke('lantern_room');
      a.invoke('lantern_meal');
      a.invoke('lantern_ale');
      if (mutation === 'entitlement')
        a.sql
          .prepare(
            "UPDATE state_row SET value='false' WHERE section='facts' AND key LIKE '%lantern_bed_paid%'",
          )
          .run();
      else if (mutation === 'meals')
        a.sql
          .prepare("UPDATE state_row SET value=? WHERE section='resources' AND key=?")
          .run(
            JSON.stringify({ value: 4, at: 0 }),
            resourceKey(a.initial, entity(a.initial, 'npc', 'maud'), 'lantern_meals'),
          );
      else if (mutation === 'ale')
        a.sql
          .prepare("UPDATE state_row SET value=? WHERE section='liquids' AND key=?")
          .run(
            JSON.stringify({ kind: ref('liquid', 'ale'), quantity: 4 }),
            entity(a.initial, 'item', 'lantern_ale_cask'),
          );
      else {
        const row = a.sql
          .prepare(
            "SELECT invocation_id,command,response FROM receipt WHERE json_extract(command,'$.payload.service.key')='lantern_meal'",
          )
          .get()!;
        const command = JSON.parse(row.command as string),
          decision = JSON.parse(row.response as string);
        if (mutation === 'service') command.payload.service.key = 'lantern_room';
        if (mutation === 'provider') command.payload.provider_id = entity(a.initial, 'npc', 'peg');
        if (mutation === 'quote') command.payload.quoted_price = 1;
        if (mutation === 'payment') decision.delta.ops.shift();
        if (mutation === 'stock')
          decision.delta.ops = decision.delta.ops.filter(
            (o: any) => o.resource?.key !== 'lantern_meals',
          );
        if (mutation === 'benefit')
          decision.delta.ops = decision.delta.ops.filter((o: any) => o.resource?.key !== 'mv');
        a.sql
          .prepare('UPDATE receipt SET command=?,response=? WHERE invocation_id=?')
          .run(JSON.stringify(command), JSON.stringify(decision), row.invocation_id);
      }
      const before = disk(a);
      assert.equal(a.refuse().kind, 'save_corrupt', mutation);
      assert.deepEqual(disk(a), before, mutation);
    } finally {
      a.sql.close();
    }
  }
  // No other history triggers: the service guard alone must refuse an unearned paid entitlement.
  const dir = mkdtempSync(join(tmpdir(), 'loka-service-only-')),
    path = join(dir, 'save.db');
  t.after(() => rmSync(dir, { recursive: true }));
  const a = setup(path, (c) => {
    delete c.liquids;
    for (const i of Object.values(c.items) as any[]) {
      delete i.vessel;
      delete i.fuel;
    }
    for (const q of Object.values(c.quests) as any[]) {
      if (q.patrol)
        q.objective = {
          evidence: 'current_state',
          policy: { policy_version: 1, root: { op: 'all', items: [] } },
        };
      delete q.exchange;
      delete q.repeatable;
      delete q.patrol;
    }
    for (const d of Object.values(c.dialogues) as any[])
      for (const o of Object.values(d.choices) as any[]) {
        delete o.exchange;
        delete o.patrol;
      }
    for (const r of Object.values(c.rooms) as any[])
      for (const d of Object.values(r.details ?? {}) as any[]) delete d.liquid_source;
    delete c.services[`${prefix}:service/lantern_ale`];
    delete c.services[`${prefix}:service/lantern_meal`];
    c.npcs[`${prefix}:npc/maud`].services = [ref('service', 'lantern_room')];
  });
  try {
    a.sql.prepare('INSERT INTO state_row VALUES (?,?,?)').run(
      'facts',
      JSON.stringify({
        kind: 'fact',
        fact: ref('fact', 'lantern_bed_paid'),
        scope: { kind: 'player', character_id: a.initial.character },
      }),
      'true',
    );
    const before = disk(a),
      bytes = readFileSync(path);
    a.sql.close();
    const sql = new DatabaseSync(path);
    const db: Db = {
      execSync: (q) => sql.exec(q),
      runSync: (q, ...params) => sql.prepare(q).run(...params),
      getFirstSync: <T>(q: string, ...params: (string | number | null)[]) =>
        (sql.prepare(q).get(...params) ?? null) as T | null,
      getAllSync: <T>(q: string, ...params: (string | number | null)[]) =>
        sql.prepare(q).all(...params) as T[],
      isInTransactionSync: () => sql.isTransaction,
    };
    try {
      assert.equal(openStory(db, a.releases, a.host).kind, 'save_corrupt');
      assert.deepEqual(disk({ ...a, sql }), before);
      assert.deepEqual(readFileSync(path), bytes);
    } finally {
      sql.close();
    }
  } finally {
    if (a.sql.isOpen) a.sql.close();
  }
});

// Breaks: memory adopts/announces service before a known COMMIT, fencing allows input/elapsed, or receipt retry pays twice.
test('real failed COMMIT and both uncertain outcomes keep room/meal/ale all old or all new', () => {
  for (const service of ['lantern_room', 'lantern_meal', 'lantern_ale'])
    for (const kind of ['failed', 'lost'] as const) {
      const a = setup();
      try {
        const prior = a.story.world(),
          before = disk(a),
          i = a.attempt(service);
        a.sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
        );
        a.fault.kind = kind;
        a.fault.armed = true;
        assert.equal(a.story.invoke(i).kind, 'pending');
        assert.equal(a.story.world(), prior);
        assert.equal(a.story.invoke(a.attempt('lantern_room')).kind, 'pending');
        assert.equal(
          a.story.elapsed({ expected_run_id: a.story.runId(), from: 0, until: 1 }).kind,
          'pending',
        );
        a.fault.reads = false;
        if (a.sql.isTransaction) a.sql.exec('ROLLBACK');
        a.reopen();
        const next =
          service === 'lantern_room'
            ? { money: [17, 13], stock: 4, ale: 4, mv: 50 }
            : service === 'lantern_meal'
              ? { money: [18, 12], stock: 3, ale: 4, mv: 62 }
              : { money: [19, 11], stock: 4, ale: 3, mv: 54 };
        assert.deepEqual(
          truth(a),
          kind === 'lost' ? next : { money: [20, 10], stock: 4, ale: 4, mv: 50 },
        );
        if (kind === 'failed') assert.deepEqual(disk(a), before);
        const retry = a.story.invoke(i);
        assert.equal(retry.kind, 'saved');
        if (retry.kind === 'saved') assert.equal(retry.replay, kind === 'lost');
        a.reopen();
        assert.deepEqual(truth(a), next);
        const saved = disk(a);
        assert.equal(a.story.invoke(i).kind, 'saved');
        assert.deepEqual(disk(a), saved);
      } finally {
        a.sql.close();
      }
    }
});

// Breaks: differently keyed meal action gets omitted, Book sends use_service instead of the alias, or recovery routes a line to World/another NPC.
test('real Book captured alias press and lost acknowledgement restore one original-Maud line', (t) => {
  const a = setup();
  t.after(() => a.sql.close());
  const book = presenter(a.game);
  a.game.subscribe(book.update);
  const maud = entity(a.initial, 'npc', 'maud'),
    screen = book.screen(),
    button = screen.buttons.find((b) => b.action_key === 'eat_lantern_meal')!;
  assert.deepEqual(intentOf(button).target_ids, [maud]);
  assert.equal(intentOf(button).input.quoted_price, 2);
  assert.equal(
    group(screen.buttons).place.some((b) => b.command === 'use_service'),
    false,
  );
  book.press(button, maud);
  assert.deepEqual(
    book
      .screen()
      .view.resources!.filter((r) => ['pennies', 'mv'].includes(r.resource.key))
      .map((r) => [r.resource.key, r.current]),
    [
      ['mv', 62],
      ['pennies', 18],
    ],
  );
  const line = 'Maud takes two pennies and serves bread. You eat the meal and recover movement.';
  assert.deepEqual(book.screen().detail(maud), [line]);
  assert.deepEqual(book.screen().log, []);
  const reopened = presenter(openGame(a.db, a.b, a.host));
  assert.deepEqual(reopened.screen().detail(maud), [line]);
  assert.deepEqual(reopened.screen().log, []);
  const b = setup();
  t.after(() => b.sql.close());
  const pending = presenter(b.game);
  b.game.subscribe(pending.update);
  b.fault.kind = 'lost';
  b.fault.armed = true;
  const meal = pending.screen().buttons.find((x) => x.action_key === 'eat_lantern_meal')!;
  pending.press(meal, maud);
  assert.deepEqual(pending.screen().detail(maud), []);
  b.fault.reads = false;
  pending.press(meal, maud);
  assert.deepEqual(pending.screen().detail(maud), [line]);
  const rental = pending.screen().buttons.find((x) => x.action_key === 'rent_lantern_room')!;
  pending.press(rental, maud);
  const up = pending
    .screen()
    .buttons.find((x) => x.action_key === 'move' && (x.input as any).direction === 'up')!;
  pending.press(up);
  const bed = pending.screen().view.notices!.find((n) => n.bed)!;
  assert.equal(bed.description, 'detail.bed.paid');
  const rest = pending
    .screen()
    .buttons.find((x) => x.detail_id === bed.id && x.action_key === 'rest')!;
  assert.deepEqual(rest.target_ids, []);
  const before = pending.screen().view;
  pending.press(rest, bed.id);
  const after = pending.screen().view;
  assert.equal(after.position, 'resting');
  assert.deepEqual(pagesAfter([{ kind: 'notice', id: bed.id }], before, after), [
    { kind: 'notice', id: bed.id },
  ]);
});

// Breaks: adding service controls displaces exact S1 Talk/turn-in, or a lawful death invalidates paid/consumed historical service evidence.
test('S1 remains reachable beside services and same-body fatal return reopens the paid bed truth', (t) => {
  const a = setup(':memory:', (c) => {
    delete c.world.death_credit;
    for (let n = 1; n <= 5; n++)
      c.facts[`${prefix}:fact/rat_${n}_killed`].value_type.default = true;
  });
  t.after(() => a.sql.close());
  let n = 0;
  const ok = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    const r = a.story.invoke({
      invocation_id: `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      actor_id: a.initial.character,
      action_key,
      target_ids,
      input,
    });
    assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
  };
  const maud = entity(a.initial, 'npc', 'maud');
  // Read the actual authority world via a reopened session so the controls reflect raw invokes.
  const exactTalk = () =>
    openGame(a.db, a.b, a.host)
      .view()
      .view.entities.find((e) => e.id === maud)!
      .actions.find((x) => ['maud_offer', 'maud_turn_in'].includes(x.action_key) && x.available)!;
  assert.equal(exactTalk().action_key, 'maud_offer');
  a.invoke('lantern_room');
  a.reopen();
  ok('maud_offer', [maud]);
  const choice = Object.entries(a.story.world().state.choices!).find(
    ([, c]) => c.status === 'pending',
  )!;
  ok('choose', [], { continuation_id: choice[0], choice_id: 'accept' });
  a.reopen();
  assert.equal(exactTalk().action_key, 'maud_turn_in');
  a.invoke('lantern_meal');
  ok('maud_turn_in', [maud]);
  const done = Object.entries(a.story.world().state.choices!).find(
    ([, c]) => c.status === 'pending',
  )!;
  ok('choose', [], { continuation_id: done[0], choice_id: 'done' });
  a.reopen();
  assert.equal(
    a.story.world().state.containers[entity(a.initial, 'item', 'cellar_key')],
    a.initial.body,
  );
  assert.equal(
    openGame(a.db, a.b, a.host)
      .view()
      .view.entities.find((e) => e.id === maud)!
      .services!.filter((s) => s.action.available).length,
    2,
  );
  const b = setup(':memory:', (c) => {
    c.resources[`${prefix}:resource/hp`].start = 1;
    c.npcs[`${prefix}:npc/cellar_rat_1`].attack.chance = 100;
  });
  t.after(() => b.sql.close());
  b.invoke('lantern_room');
  b.invoke('lantern_meal');
  b.invoke('lantern_ale');
  const invoke = (action_key: string, target_ids: string[] = [], input: object = {}) =>
    b.story.invoke({
      invocation_id: `ffffffff-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      actor_id: b.initial.character,
      action_key,
      target_ids,
      input,
    });
  assert.equal(invoke('move', [], { direction: 'down' }).kind, 'saved');
  assert.equal(invoke('attack', [entity(b.initial, 'npc', 'cellar_rat_1')]).kind, 'saved');
  b.reopen();
  for (
    let i = 0;
    i < 6 &&
    Object.values(b.story.world().state.encounters ?? {}).some((e: any) => e.status === 'open');
    i++
  ) {
    const from = b.story.world().state.clock;
    assert.equal(
      b.story.elapsed({ expected_run_id: b.story.runId(), from, until: from + 150 }).kind,
      'saved',
    );
  }
  b.reopen();
  const w = b.story.world();
  assert.equal(w.body, b.initial.body);
  assert.equal(w.state.containers[w.body], b.initial.roomIds[`${prefix}:room/chapel_nave`]);
  assert.deepEqual(amounts(w), [14, 16]);
  assert.equal(stock(w), 3);
  assert.equal(ale(w).quantity, 3);
  assert.ok(Object.values(w.entities).some((e) => e.kind === 'item' && e.key === 'player_corpse'));
});
