// D1 uses the real rollback-journal SQLite host, not browser refresh as a fault oracle.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  bundle,
  genesis,
  ref,
  room,
  entity,
  endpoint,
  coins,
  prefix,
  open as openRides,
  hound,
} from '../../../kernel/ts/test/transport_fixture.ts';
import { gameView } from '../../../kernel/ts/src/index.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { presenter } from '../../app/book/presenter.ts';
import { group, pagesAfter, intentOf } from '../../app/book/model.ts';

function setup(path = ':memory:', more: (c: any) => void = () => {}) {
  const change = (c: any) => {
    openRides(c);
    more(c);
  };
  const b = bundle(change),
    initial = genesis(change),
    releases = [{ fresh: initial, content_hash: b.sha256 }] as const;
  let p = elapsedHost(path, { wall: 10000, mono: 0 }, b),
    n = 0;
  const open = () => {
    const s = openStory(p.db, releases, p.host);
    assert.equal(s.kind, 'open', JSON.stringify(s));
    if (s.kind !== 'open') throw new Error('transport save');
    return s;
  };
  let story = open();
  const attempt = (action_key: string, input: object = {}, target_ids: string[] = []) => ({
    invocation_id: `cccccccc-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    actor_id: initial.character,
    action_key,
    input,
    target_ids,
  });
  const invoke = (action: string, input: object = {}, ids: string[] = []) => {
    const i = attempt(action, input, ids),
      r = story.invoke(i);
    assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
    return i;
  };
  const ferry = (key = 'north_road') =>
    attempt(
      key === 'north_road' ? 'ride_south' : 'ride_north',
      { route: ref('transport', key), quoted_fare: 3 },
      [endpoint(initial, key)],
    );
  const cross = (key = 'north_road') => {
    const i = ferry(key),
      r = story.invoke(i);
    assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
    return i;
  };
  return {
    initial,
    attempt,
    invoke,
    ferry,
    cross,
    get story() {
      return story;
    },
    get sql() {
      return p.sql;
    },
    get fault() {
      return p.fault;
    },
    get game() {
      return p.game;
    },
    get db() {
      return p.db;
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
  money: coins(a.story.world()),
  place: a.story.world().state.containers[a.initial.body],
});

// Breaks: fare or room entry fails cold reopen/replay, or old transport evidence depends on later room custody.
test('paid outbound and return crossings reopen at committed boundaries', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-transport-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const a = setup(join(dir, 'save.db'));
  t.after(() => a.sql.close());
  a.reopen();
  const out = a.cross();
  a.reopen();
  assert.deepEqual(truth(a), { money: [7, 3], place: room(a.initial, 'south_post') });
  assert.equal(a.story.invoke(out).kind, 'saved');
  assert.deepEqual(coins(a.story.world()), [7, 3]);
  a.invoke('move', { direction: 'north' });
  a.reopen();
  a.invoke('move', { direction: 'south' });
  a.reopen();
  a.cross('south_road');
  a.reopen();
  assert.deepEqual(truth(a), { money: [4, 6], place: room(a.initial, 'north_post') });
});
// Breaks: malformed charge, endpoint/recipient, body transfer or room entry is accepted during historical
// validation and silently repaired. fast_travel_sampler is transport-only, so 'entry' also proves
// transport saves validate history with no other history producer.
test('forged ride receipts and saved custody refuse typed corruption without changing the database', () => {
  for (const mutation of ['payment', 'recipient', 'endpoint', 'quote', 'move', 'entry', 'state']) {
    const a = setup();
    try {
      a.cross();
      const row = a.sql
          .prepare(
            "SELECT invocation_id,command,response FROM receipt WHERE json_extract(command,'$.payload.type')='use_transport'",
          )
          .get()!,
        c = JSON.parse(row.command as string),
        d = JSON.parse(row.response as string);
      if (mutation === 'payment')
        d.delta.ops = d.delta.ops.filter((o: any) => o.op !== 'resource.adjust');
      if (mutation === 'recipient') d.delta.ops[1].entity_id = a.initial.body;
      if (mutation === 'endpoint') c.payload.endpoint_id = endpoint(a.initial, 'south_road');
      if (mutation === 'quote') c.payload.quoted_fare = 0;
      if (mutation === 'move')
        d.delta.ops = d.delta.ops.filter((o: any) => o.op !== 'entity.transfer');
      if (mutation === 'entry') d.events = [];
      if (mutation === 'state')
        a.sql
          .prepare("UPDATE state_row SET value=? WHERE section='containers' AND key=?")
          .run(JSON.stringify(room(a.initial, 'north_post')), a.initial.body);
      else
        a.sql
          .prepare('UPDATE receipt SET command=?,response=? WHERE invocation_id=?')
          .run(JSON.stringify(c), JSON.stringify(d), row.invocation_id);
      const before = disk(a);
      assert.equal(a.refuse().kind, 'save_corrupt', mutation);
      assert.deepEqual(disk(a), before, mutation);
    } finally {
      a.sql.close();
    }
  }
});
// Breaks: COMMIT uncertainty adopts a crossing early, permits input, loses a receipt, or retry moves/debits twice.
test('real failed and uncertain COMMIT outcomes fence paid and waived crossings then replay once', () => {
  for (const boundary of ['outbound', 'return', 'recovery'])
    for (const fault of ['known_failed', 'failed', 'lost'] as const) {
      const a = boundary === 'recovery' ? deathSetup() : setup();
      try {
        let i;
        if (boundary === 'recovery') {
          die(a);
          i = a.ferry('south_road');
        } else if (boundary === 'outbound') i = a.ferry();
        else {
          a.cross();
          i = a.ferry('south_road');
        }
        const prior = a.story.world(),
          before = disk(a),
          old = truth(a);
        a.sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
        );
        a.fault.kind = fault === 'known_failed' ? 'failed' : fault;
        a.fault.armed = true;
        if (fault === 'known_failed') {
          const exec = a.db.execSync;
          a.db.execSync = (operation) => {
            try {
              exec(operation);
            } catch (error) {
              a.fault.reads = false;
              throw error;
            }
          };
          assert.throws(() => a.story.invoke(i), /COMMIT failed; nothing was saved/);
        } else assert.equal(a.story.invoke(i).kind, 'pending');
        assert.equal(a.story.world(), prior);
        if (fault !== 'known_failed') {
          assert.equal(a.story.invoke(a.ferry()).kind, 'pending');
          assert.equal(
            a.story.elapsed({ expected_run_id: a.story.runId(), from: 0, until: 1 }).kind,
            'pending',
          );
        }
        a.fault.reads = false;
        if (a.sql.isTransaction) a.sql.exec('ROLLBACK');
        a.reopen();
        const next = {
          money: boundary === 'recovery' ? [0, 0] : boundary === 'return' ? [4, 6] : [7, 3],
          place: room(a.initial, boundary === 'outbound' ? 'south_post' : 'north_post'),
        };
        assert.deepEqual(truth(a), fault === 'lost' ? next : old);
        if (fault !== 'lost') assert.deepEqual(disk(a), before);
        const retry = a.story.invoke(i);
        assert.equal(retry.kind === 'saved' && retry.replay, fault === 'lost');
        a.reopen();
        assert.deepEqual(truth(a), next);
        const saved = disk(a);
        a.story.invoke(i);
        assert.deepEqual(disk(a), saved);
      } finally {
        a.sql.close();
      }
    }
});
// Breaks: Book loses the endpoint's captured base quote, sends another action, narrates twice or keeps the boarding detail after arrival.
test('Book projects an exact boarding control and restores one committed endpoint result', (t) => {
  const a = setup();
  t.after(() => a.sql.close());
  const book = presenter(a.game);
  a.game.subscribe(book.update);
  const before = book.screen(),
    b = before.buttons.find((b) => b.action_key === 'ride_south')!,
    id = endpoint(a.initial, 'north_road');
  assert.deepEqual(intentOf(b).target_ids, [id]);
  assert.deepEqual(JSON.parse(JSON.stringify(intentOf(b).input)), {
    route: ref('transport', 'north_road'),
    quoted_fare: 3,
  });
  assert.equal(
    group(before.buttons).place.some((b) => b.command === 'use_transport'),
    false,
  );
  book.press(b, id);
  book.press(b, id);
  const after = book.screen();
  assert.equal(after.view.place.id, room(a.initial, 'south_post'));
  assert.deepEqual(pagesAfter([{ kind: 'notice', id }], before.view, after.view), []);
  const line = 'The carter whips up the horse, and the cart sets you down at the South Post.';
  assert.equal(after.detail(id).filter((x) => x === line).length, 1);
  assert.deepEqual(presenter(a.game).screen().detail(id), [line]);
});

// A penniless player with one lantern dies to the hound at north_post and returns at the
// south_post shrine; south_road's recovery room is north_post.
function deathSetup(path = ':memory:') {
  return setup(path, (c) => {
    hound(c);
    // bleed_sampler's clock: the encounter job runs on authority elapsed time.
    c.manifest.time_policy = { profile: 'real_elapsed', rate: 50 };
    const npc = c.npcs[`${prefix}:npc/hound`];
    npc.attack = { ...npc.attack, chance: 100 };
    c.world.combat = {
      ...c.world.combat,
      player_attack: { ...c.world.combat.player_attack, chance: 0 },
    };
    c.resources[`${prefix}:resource/coins`].start = 0;
    c.resources[`${prefix}:resource/hp`].start = 1;
    c.items[`${prefix}:item/lantern`] = {
      key: 'lantern',
      keywords: ['lantern'],
      short: 'item.lantern.short',
      description: 'item.lantern.description',
      room_line: 'item.lantern.room',
      mass_grams: 10,
      location: { in: 'room', room: ref('room', 'north_post') },
    };
    Object.assign(c.text, {
      'item.lantern.short': 'a lantern',
      'item.lantern.description': 'A lantern.',
      'item.lantern.room': 'A [lantern](lantern) stands here.',
    });
  });
}
function die(a: ReturnType<typeof setup>) {
  const lantern = entity(a.initial, 'item', 'lantern');
  a.invoke('take', {}, [lantern]);
  a.invoke('attack', {}, [entity(a.initial, 'npc', 'hound')]);
  const due = Object.values(a.story.world().state.jobs!).find(
    (j) => j.status === 'pending' && j.encounter_id,
  )!.due_time;
  const from = a.story.world().state.clock,
    r = a.story.elapsed({ expected_run_id: a.story.runId(), from, until: due });
  assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
  const w = a.story.world(),
    corpse = Object.entries(w.state.created!).find(
      ([, r]) => r.origin.kind === 'death' && r.origin.owner_id === w.character,
    )![0];
  assert.equal(w.state.containers[w.body], room(w, 'south_post'));
  assert.equal(w.state.containers[corpse], room(w, 'north_post'));
  // D6 must leave this actual nonempty corpse to the fare-waived physical trip.
  assert.equal(gameView(w).corpse_recovery, undefined);
  assert.equal(w.state.containers[lantern], corpse);
  assert.deepEqual(coins(w), [0, 0]);
  return { corpse, lantern };
}
// Breaks: shrine death return strands a penniless actor, or recovery invalidates its earlier waived receipt.
test('actual shrine death return reaches the corpse without coins and retains its contents on cold reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-transport-recovery-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const a = deathSetup(join(dir, 'save.db'));
  t.after(() => a.sql.close());
  const { corpse, lantern } = die(a);
  a.reopen();
  assert.deepEqual(gameView(a.story.world()).inventory, []);
  const offer = gameView(a.story.world()).notices!.find((n) => n.transport)!.transport!;
  assert.deepEqual([offer.fare, offer.charge, offer.waived], [3, 0, true]);
  a.cross('south_road');
  a.reopen();
  const body = gameView(a.story.world()).entities.find((e) => e.id === corpse)!;
  assert.equal(body.contents!.find((e) => e.id === lantern)!.container_id, corpse);
  a.invoke('take', {}, [lantern]);
  a.reopen();
  const w = a.story.world();
  assert.equal(w.state.containers[lantern], w.body);
  assert.equal(w.state.containers[corpse], room(w, 'north_post'));
  assert.deepEqual(coins(w), [0, 0]);
});
