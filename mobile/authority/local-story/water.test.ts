// Real SQLite and the existing fault injector; teacher/gear locations are declared controlled inputs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle, fresh, room, entity, prefix, ref } from '../../../kernel/ts/test/water_fixture.ts';
import { gameView } from '../../../kernel/ts/src/index.ts';
import { openGame } from './session.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { presenter } from '../../app/book/presenter.ts';
import { group, intentOf } from '../../app/book/model.ts';

function setup(path = ':memory:', change: (c: any) => void = () => {}) {
  const b = bundle(change),
    initial = fresh(change),
    releases = [{ fresh: initial, content_hash: b.sha256 }] as const;
  let p = elapsedHost(path, { wall: 10000, mono: 0 }, b),
    n = 0;
  const open = () => {
    const s = openStory(p.db, releases, p.host);
    assert.equal(s.kind, 'open', JSON.stringify(s));
    if (s.kind !== 'open') throw new Error('water save');
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
  const lesson = () => {
    const talk = gameView(story.world())
      .entities.find((e) => e.id === entity(initial, 'npc', 'sedge'))!
      .actions.find((a) => a.label === 'sedge.swim.choice' && a.available)!;
    invoke(talk.action_key, {}, [entity(initial, 'npc', 'sedge')]);
    invoke('choose', {
      continuation_id: gameView(story.world()).choice!.continuation_id,
      choice_id: 'learn',
    });
  };
  const prepared = () => {
    lesson();
    invoke('take', {}, [entity(initial, 'item', 'trunk')]);
    invoke('take', {}, [entity(initial, 'item', 'brass_key')]);
  };
  const lapse = (milliseconds: number) => {
    p.clock.mono += milliseconds;
    p.clock.wall += milliseconds;
    return story.pulse('active', story.runId());
  };
  const deaths = () =>
    Object.entries(story.world().state.created ?? {}).filter(([, i]) => i.origin.kind === 'death');
  const expire = () => {
    invoke('move', { direction: 'down' });
    lapse(120000);
    assert.equal(story.world().state.clock, 70800);
    assert.equal(deaths().length, 1);
    return deaths()[0][0];
  };
  return {
    initial,
    b,
    releases,
    attempt,
    invoke,
    lesson,
    prepared,
    lapse,
    expire,
    deaths,
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
    get clock() {
      return p.clock;
    },
    get game() {
      return p.game;
    },
    reopen() {
      if (path !== ':memory:') {
        const clocks = { wall: p.clock.wall, mono: 0 };
        p.sql.close();
        p = elapsedHost(path, clocks, b);
      }
      story = open();
    },
    refuse: () => openStory(p.db, releases, p.host),
  };
}
const disk = (a: ReturnType<typeof setup>) =>
  ['state_row', 'head', 'receipt', 'elapsed'].map((t) =>
    a.sql.prepare(`SELECT * FROM ${t} ORDER BY 1,2`).all(),
  );

// Breaks: cold reopen renews a dive, exact-time Up races past expiry, nested roots split custody, or later legal movement invalidates historical recovery.
test('water entry/surface/expiry/recovery reopen with original deadline and custody, then replay once', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-water-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const a = setup(join(dir, 'save.db'));
  t.after(() => a.sql.close());
  a.prepared();
  const entered = a.invoke('move', { direction: 'down' });
  a.reopen();
  assert.equal(a.story.world().state.water![a.initial.character].deadline, 70800);
  const rows = disk(a);
  assert.equal(a.story.invoke(entered).kind, 'saved');
  assert.deepEqual(disk(a), rows);
  a.invoke('move', { direction: 'up' });
  a.reopen();
  assert.equal(gameView(a.story.world()).water, undefined);
  // Ordinary standing recovery gives enough MV for another dive; no old job can consume the new deadline.
  a.lapse(120000);
  a.reopen();
  a.invoke('move', { direction: 'down' });
  a.reopen();
  assert.equal(a.story.world().state.water![a.initial.character].deadline, 76800);
  const captured = {
    ...a.attempt('move', { direction: 'up' }),
    view_freshness_token: a.story.token(),
  };
  a.clock.mono += 120000;
  a.clock.wall += 120000;
  const r = a.story.invoke(captured);
  assert.equal(r.kind, 'stale_view');
  assert.equal(a.story.world().state.containers[a.initial.body], room(a.initial, 'chapel_nave'));
  assert.equal(a.deaths().length, 1);
  a.reopen();
  assert.equal(a.story.invoke(captured).kind, 'stale_view');
  const corpse = a.deaths()[0][0],
    trunk = entity(a.initial, 'item', 'trunk'),
    torch = entity(a.initial, 'item', 'torch');
  assert.equal(a.story.world().state.containers[trunk], corpse);
  assert.equal(a.story.world().state.containers[torch], trunk);
  const recovery = a.invoke('recover_corpse', {}, [corpse]);
  a.reopen();
  assert.equal(a.story.world().state.containers[trunk], a.initial.body);
  assert.equal(a.story.world().state.containers[torch], trunk);
  const recovered = disk(a);
  a.story.invoke(recovery);
  assert.deepEqual(disk(a), recovered);
  a.invoke('drop', {}, [trunk]);
  a.reopen();
  assert.equal(a.story.world().state.containers[trunk], room(a.initial, 'chapel_nave'));
  assert.ok(a.story.world().state.created![corpse]);
  assert.equal(gameView(a.story.world()).corpse_recovery, undefined);
});

// Breaks: reserved absence on cold reopen is ignored, or a resume starts a fresh 6000 seconds.
test('cold elapsed debt settles the original drowning deadline before input', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-water-absence-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const a = setup(join(dir, 'save.db'));
  t.after(() => a.sql.close());
  a.prepared();
  a.invoke('move', { direction: 'down' });
  a.clock.wall += 120000;
  a.reopen();
  assert.equal(a.deaths().length, 1);
  assert.equal(a.story.world().state.containers[a.initial.body], room(a.initial, 'chapel_nave'));
  assert.equal(a.story.world().state.water![a.initial.character].deadline, null);
});

// Breaks: a failed or lost COMMIT adopts entry/surface/recovery early, allows later input, or replay allocates a second occurrence or transfers roots twice.
test('real failed, uncertain absent and committed COMMIT outcomes fence water commands and reconcile once', () => {
  for (const boundary of ['entry', 'surface', 'recovery'])
    for (const fault of ['known_failed', 'failed', 'lost'] as const) {
      const a = setup();
      try {
        a.prepared();
        let i;
        if (boundary === 'entry') i = a.attempt('move', { direction: 'down' });
        else if (boundary === 'surface') {
          a.invoke('move', { direction: 'down' });
          i = a.attempt('move', { direction: 'up' });
        } else {
          const corpse = a.expire();
          i = a.attempt('recover_corpse', {}, [corpse]);
        }
        const prior = a.story.world(),
          before = disk(a);
        a.sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
        );
        a.fault.kind = fault === 'known_failed' ? 'failed' : fault;
        a.fault.armed = true;
        if (fault === 'known_failed') {
          const exec = a.db.execSync;
          a.db.execSync = (op) => {
            try {
              exec(op);
            } catch (e) {
              a.fault.reads = false;
              throw e;
            }
          };
        }
        if (fault === 'known_failed')
          assert.throws(() => a.story.invoke(i), /COMMIT failed; nothing was saved/);
        else assert.equal(a.story.invoke(i).kind, 'pending', boundary + ':' + fault);
        assert.deepEqual(a.story.world().state, prior.state);
        if (fault !== 'known_failed')
          assert.equal(a.story.invoke(a.attempt('look')).kind, 'pending');
        a.fault.reads = false;
        if (a.sql.isTransaction) a.sql.exec('ROLLBACK');
        if (fault === 'known_failed') assert.deepEqual(disk(a), before);
        const resolved = a.story.invoke(i);
        assert.equal(
          resolved.kind === 'saved' && (resolved.decision as any).kind,
          'accepted',
          JSON.stringify(resolved),
        );
        const after = disk(a);
        a.story.invoke(i);
        assert.deepEqual(disk(a), after);
        a.reopen();
      } finally {
        a.sql.close();
      }
    }
});

// Breaks: saved generation/deadline/body/job/cause/owner/transfer corruption is accepted or repaired, or compares old custody to current custody.
test('malformed water and historical recovery rows refuse save_corrupt without rewriting progress', () => {
  for (const mutation of [
    'generation',
    'deadline',
    'body',
    'job',
    'job_row',
    'cause',
    'owner',
    'transfer',
  ]) {
    const a = setup();
    try {
      a.prepared();
      a.invoke('move', { direction: 'down' });
      if (['generation', 'deadline', 'body', 'job', 'job_row'].includes(mutation)) {
        const row = a.sql.prepare("SELECT key,value FROM state_row WHERE section='water'").get()!,
          v = JSON.parse(row.value as string);
        if (mutation === 'generation') v.generation = 0;
        if (mutation === 'deadline') v.deadline = 70801;
        if (mutation === 'body') v.body_id = entity(a.initial, 'npc', 'sedge');
        if (mutation === 'job') v.job_id = 'aaaaaaaa-0000-4000-8000-000000000001';
        a.sql
          .prepare("UPDATE state_row SET value=? WHERE section='water' AND key=?")
          .run(JSON.stringify(v), row.key);
        if (mutation === 'job_row') {
          a.lapse(120000);
          a.sql
            .prepare("UPDATE state_row SET value='null' WHERE section='jobs' AND key=?")
            .run(v.job_id);
        }
      } else {
        a.lapse(120000);
        const corpse = a.deaths()[0][0];
        if (mutation === 'owner') {
          const row = a.sql
            .prepare("SELECT value FROM state_row WHERE section='created' AND key=?")
            .get(corpse)!;
          const v = JSON.parse(row.value as string);
          v.origin.owner_id = 'aaaaaaaa-0000-4000-8000-000000000001';
          a.sql
            .prepare("UPDATE state_row SET value=? WHERE section='created' AND key=?")
            .run(JSON.stringify(v), corpse);
        } else {
          if (mutation === 'transfer') a.invoke('recover_corpse', {}, [corpse]);
          const row = a.sql
              .prepare(
                mutation === 'cause'
                  ? "SELECT invocation_id,response FROM receipt WHERE json_extract(command,'$.payload.type')='elapsed' ORDER BY revision DESC LIMIT 1"
                  : "SELECT invocation_id,response FROM receipt WHERE json_extract(command,'$.payload.type')='recover_corpse'",
              )
              .get()!,
            d = JSON.parse(row.response as string);
          if (mutation === 'cause')
            d.events.find((e: any) => e.payload.type === 'entity_died').payload.cause = 'combat';
          else d.delta.ops[0].source_id = room(a.initial, 'well_bottom');
          a.sql
            .prepare('UPDATE receipt SET response=? WHERE invocation_id=?')
            .run(JSON.stringify(d), row.invocation_id);
        }
      }
      const before = disk(a);
      assert.equal(a.refuse().kind, 'save_corrupt', mutation);
      assert.deepEqual(disk(a), before, mutation);
    } finally {
      a.sql.close();
    }
  }
});

// Breaks: the Book loses captured free Surface on detail navigation or prints recovery before confirmed custody, repeats it, or loses it on reopen.
test('Book projects warning, confirmed remaining time, free Surface and selected original recovery once', (t) => {
  const a = setup();
  t.after(() => a.sql.close());
  a.prepared();
  a.invoke('move', { direction: 'down' });
  const game = openGame(a.db, a.b, a.host),
    book = presenter(game),
    screen = book.screen();
  game.subscribe(book.update);
  assert.equal(screen.view.water!.remaining, 6000);
  const surface = screen.buttons.find((b) => b.label === 'Surface (free)')!;
  assert.deepEqual(intentOf(surface), {
    action_key: 'move',
    target_ids: [],
    input: { direction: 'up' },
    view_freshness_token: game.view().token,
  });
  assert.equal(group(screen.buttons).exits.find((e) => e.direction === 'up')!.button, surface);
  // The same captured control is passed above every Book page by Body; browser rendering proof is deferred to final integration.
  a.clock.mono += 120000;
  a.clock.wall += 120000;
  game.pulse('active');
  const recovery = book.screen().buttons.find((b) => b.action_key === 'recover_corpse')!;
  assert.ok(recovery.label.includes('Well Bottom'));
  assert.equal(recovery.target_ids.length, 1);
  book.press(recovery);
  assert.ok(book.screen().log.join(' ').includes('You recover'));
  assert.ok(book.screen().log.join(' ').includes('trunk'));
  const once = book.screen().log.filter((s) => s.includes('You recover'));
  book.press(recovery);
  assert.deepEqual(
    book.screen().log.filter((s) => s.includes('You recover')),
    once,
  );
  a.reopen();
  assert.equal(gameView(a.story.world()).corpse_recovery, undefined);
});

// Breaks: an uncertain expiry splits HP/corpse/custody/water/job rows, or retries the fatal occurrence twice.
test('expiry COMMIT committed and absent branches reconcile one actual corpse with no split custody', () => {
  for (const fault of ['failed', 'lost'] as const) {
    const a = setup();
    try {
      a.prepared();
      a.invoke('move', { direction: 'down' });
      a.lapse(119980);
      assert.equal(a.story.world().state.clock, 70799);
      a.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
      let commits = 0;
      const exec = a.db.execSync;
      a.db.execSync = (operation) => {
        if (operation === 'COMMIT' && ++commits === 1) {
          a.fault.kind = fault;
          a.fault.armed = true;
          if (fault === 'failed') a.sql.exec('INSERT INTO child VALUES(1)');
        }
        exec(operation);
      };
      const prior = a.story.world();
      a.clock.mono += 20;
      a.clock.wall += 20;
      const status = a.story.pulse('active', a.story.runId());
      assert.equal(
        status.kind,
        'pending',
        `${fault} commits ${commits} clock ${a.story.world().state.clock} deaths ${a.deaths().length}`,
      );
      assert.equal(a.story.world(), prior);
      assert.equal(a.story.invoke(a.attempt('look')).kind, 'pending');
      a.fault.reads = false;
      if (a.sql.isTransaction) a.sql.exec('ROLLBACK');
      assert.equal(a.story.pulse('active', a.story.runId()).kind, 'ready');
      assert.equal(a.deaths().length, 1);
      assert.equal(
        a.story.world().state.containers[a.initial.body],
        room(a.initial, 'chapel_nave'),
      );
      const corpse = a.deaths()[0][0];
      assert.equal(a.story.world().state.containers[entity(a.initial, 'item', 'trunk')], corpse);
      a.reopen();
      assert.equal(a.deaths().length, 1);
    } finally {
      a.sql.close();
    }
  }
});

// Breaks: ordinary sleeping recovery is suppressed underwater, posture renews the deadline, or a same-generation tick invalidates reserved Surface.
test('sleeping recovery stays ordinary and elapsed preflight within one generation still surfaces free', (t) => {
  const a = setup();
  t.after(() => a.sql.close());
  a.prepared();
  a.invoke('move', { direction: 'down' });
  const deadline = a.story.world().state.water![a.initial.character].deadline;
  a.invoke('sleep');
  a.reopen();
  assert.equal(a.story.world().state.water![a.initial.character].deadline, deadline);
  const captured = {
    ...a.attempt('move', { direction: 'up' }),
    view_freshness_token: a.story.token(),
  };
  a.clock.mono += 2000;
  a.clock.wall += 2000;
  const r = a.story.invoke(captured);
  assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted');
  assert.equal(a.story.world().state.containers[a.initial.body], room(a.initial, 'well_shaft'));
  const mv = Object.entries(a.story.world().state.resources!).find(
    ([k]) => k.includes('"key":"mv"') && k.includes(a.initial.body),
  )![1];
  assert.equal(
    gameView(a.story.world()).resources!.find((r) => r.resource.key === 'mv')!.current,
    1,
  );
  assert.equal(mv.value, 0);
  assert.equal(mv.rate, 36);
  assert.equal(mv.remainder, 0);
  assert.equal(mv.at, 64800);
});

// Breaks: remote recovery applies voluntary carrying limits or cold validation repairs forced overload by splitting original roots.
test('real saved recovery preserves original roots when existing held gear forces overload', (t) => {
  const a = setup(':memory:', (c) => {
    // Controlled extra dry gear: the existing chest is moved to Chapel and emptied of its ring.
    c.items[`${prefix}:item/sunken_chest`].location = {
      in: 'room',
      room: ref('room', 'chapel_nave'),
    };
    c.items[`${prefix}:item/sunken_chest`].mass_grams = 12000;
    c.items[`${prefix}:item/silver_ring`].location = {
      in: 'room',
      room: ref('room', 'pool_bottom'),
    };
  });
  t.after(() => a.sql.close());
  a.prepared();
  const corpse = a.expire();
  const chest = entity(a.initial, 'item', 'sunken_chest'),
    trunk = entity(a.initial, 'item', 'trunk');
  a.invoke('take', {}, [chest]);
  a.invoke('recover_corpse', {}, [corpse]);
  a.reopen();
  assert.equal(a.story.world().state.containers[chest], a.initial.body);
  assert.equal(a.story.world().state.containers[trunk], a.initial.body);
  assert.equal(a.story.world().state.containers[entity(a.initial, 'item', 'torch')], trunk);
});

// Breaks: selection recovers the first corpse instead of the chosen ID, empties both, or a second death invalidates the first historical custody.
test('two eligible corpses select one actual identity and keep the other original roots', (t) => {
  const a = setup(':memory:', (c) => {
    // A second actual possession is reachable in the dry room on the return route.
    c.items[`${prefix}:item/old_coin`].location = { in: 'room', room: ref('room', 'well_lane') };
  });
  t.after(() => a.sql.close());
  a.prepared();
  const first = a.expire();
  for (const direction of ['south', 'south', 'south', 'south']) a.invoke('move', { direction });
  const coin = entity(a.initial, 'item', 'old_coin');
  a.invoke('take', {}, [coin]);
  a.invoke('move', { direction: 'down' });
  a.invoke('move', { direction: 'down' });
  a.lapse(120000);
  a.reopen();
  const corpses = a.deaths().map(([id]) => id),
    second = corpses.find((id) => id !== first)!;
  assert.equal(corpses.length, 2);
  assert.equal(gameView(a.story.world()).corpse_recovery!.length, 2);
  a.invoke('recover_corpse', {}, [second]);
  a.reopen();
  assert.equal(a.story.world().state.containers[coin], a.initial.body);
  assert.equal(a.story.world().state.containers[entity(a.initial, 'item', 'trunk')], first);
  assert.deepEqual(
    gameView(a.story.world()).corpse_recovery!.map((c) => c.corpse_id),
    [first],
  );
});
