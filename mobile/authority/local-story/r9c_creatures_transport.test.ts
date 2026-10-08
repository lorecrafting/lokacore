// E2 S4 durable proof: families 4, 6 and 7 on the frozen r9c_interactions artifact through the
// real authority and SQLite. Every saved step is cold-reopened from its file before the next
// consumer, then its invocation is replayed and must change nothing. Literals cite content
// under cartridges/r9c_interactions/ (owner decision (d): update in place). Seeds, hit/miss
// sequences, Flee destinations and clocks reached by combat are regression pins.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INSTALLED, gameView, loadCartridge, newWorld } from '../../../kernel/ts/src/index.ts';
import type { World } from '../../../kernel/ts/src/index.ts';
import type { DefinitionRef } from '../../../kernel/ts/src/contracts.gen.ts';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { key } from '../../../kernel/ts/src/foundation/compose.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory } from './authority.ts';
import { sqliteHost } from './__tests__/elapsed-host.test.ts';

const pin = read('protocol/fixtures/r9c_interactions_hash.json');
const ID: Record<string, string> = read('protocol/fixtures/r9c_interactions_ids.json');
const ref = (kind: string, name: string) =>
  ({
    cartridge_id: 'r9c_interactions',
    cartridge_version: '0.0.1',
    kind,
    key: name,
  }) as unknown as DefinitionRef;

function story(t: TestContext, seed: number[], ancestry: string) {
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  const initial = newWorld(
    loaded.cartridge as never,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    seed as never,
  );
  const releases = [{ fresh: initial, content_hash: pin.sha256 }] as const;
  const dir = mkdtempSync(join(tmpdir(), 'loka-r9c-s4-'));
  const path = join(dir, 'save.db');
  let p = sqliteHost(path);
  t.after(() => {
    p.sql.close();
    rmSync(dir, { recursive: true });
  });
  const open = () => {
    const s = openStory(p.db, releases, p.host);
    assert.equal(s.kind, 'open');
    if (s.kind !== 'open') throw new Error('r9c save did not open');
    return s;
  };
  let s = open(),
    n = 0;
  const rows = () => p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
  const reopen = () => {
    const before = encode(s.world().state as never);
    p.sql.close();
    p = sqliteHost(path);
    s = open();
    assert.equal(encode(s.world().state as never), before);
  };
  // Advertised actions anywhere in the view; an entity's own action targets that entity.
  const offered = (v: unknown, owner?: string, out: any[] = []): any[] => {
    if (Array.isArray(v)) v.forEach((x) => offered(x, owner, out));
    else if (v && typeof v === 'object') {
      const o = v as any;
      if ('action_key' in o && 'target' in o)
        out.push({ ...o, target_ids: o.target_ids ?? (owner ? [owner] : []) });
      else
        Object.values(o).forEach((x) => offered(x, typeof o.id === 'string' ? o.id : owner, out));
    }
    return out;
  };
  // One saved invocation: reopened from disk, then replayed once with no row change.
  const send = (action_key: string, target_ids: string[], input: object) => {
    const i = {
      invocation_id: `cccccccc-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      actor_id: initial.character,
      action_key,
      target_ids,
      input,
    };
    const reply = s.invoke(i);
    assert.equal(reply.kind, 'saved', JSON.stringify(reply));
    if (reply.kind !== 'saved') throw new Error(action_key);
    reopen();
    const disk = rows(),
      again = s.invoke(i);
    assert.equal(again.kind === 'saved' && again.replay, true, action_key);
    assert.equal(
      again.kind === 'saved' && encode(again.decision as never),
      encode(reply.decision as never),
    );
    assert.deepEqual(rows(), disk);
    return reply.decision as any;
  };
  const view = () => gameView(s.world());
  const a = {
    get w(): World {
      return s.world();
    },
    view,
    offer: (action_key: string, target_ids: string[] = []) =>
      offered(view()).find(
        (o) => o.action_key === action_key && key(o.target_ids) === key(target_ids),
      ),
    send,
    press(action_key: string, target_ids: string[] = [], input: object = {}) {
      assert.equal(a.offer(action_key, target_ids)?.available, true, action_key);
      const d = send(action_key, target_ids, input);
      assert.equal(d.kind, 'accepted', JSON.stringify(d));
      return d;
    },
    move(...directions: string[]) {
      for (const direction of directions) {
        assert.equal(view().exits.find((e) => e.direction === direction)?.available, true);
        a.press('move', [], { direction });
      }
    },
    choose(choice_id: string, answer?: string) {
      const c = view().choice!;
      assert.equal(c.choices.find((o) => o.choice_id === choice_id)?.available, true, choice_id);
      const d = send('choose', [], {
        continuation_id: c.continuation_id,
        choice_id,
        ...(answer && { answer }),
      });
      assert.equal(d.kind, 'accepted', JSON.stringify(d));
      return d;
    },
    // One elapsed window to the next pending due time (each committed round reopens).
    tick() {
      const from = s.world().state.clock;
      const until = Math.min(
        ...Object.values(s.world().state.jobs ?? {})
          .filter((j) => j.status === 'pending' && j.due_time > from)
          .map((j) => j.due_time),
      );
      const evidence = { expected_run_id: s.runId(), from, until };
      const reply = s.elapsed(evidence);
      assert.equal(reply.kind, 'saved', JSON.stringify(reply));
      if (reply.kind === 'saved') assert.equal((reply.decision as any).kind, 'accepted');
      assert.equal(s.world().state.clock, until);
      reopen();
      const disk = rows();
      s.elapsed({ ...evidence, expected_run_id: s.runId() });
      assert.deepEqual(rows(), disk);
      return until;
    },
    resource: (holder: string, name: string) =>
      s.world().state.resources![
        key({ kind: 'resource', resource: ref('resource', name), entity_id: holder } as never)
      ]?.value,
    hp: () => a.resource(s.world().body, 'hp'),
    holder: (id: string) => s.world().state.containers[id as never],
  };
  a.press('choose_ancestry', [], { ancestry });
  return a;
}

const D1 =
  'D1 route precondition changed. The r9c_interactions D1 fare waiver depends on boarding while ' +
  'bleeding (docs/reviews/2026-10-08-e2-s1-synthetic-cartridge-review.md; ' +
  'kernel/ts/src/mechanics/transport/shared.ts:55-60). Per owner decision (d) ' +
  '(docs/decisions/owner-decision-e2-plan-2026-10-07.md), the slice that changed this rule must ' +
  're-route D1 in r9c_interactions in the same slice: a content change plus independent oracle ' +
  're-pin. Do not weaken this assertion.';

// Breaks: the D1 route stops composing hound bleed, Flee, transport admission, a fatal isle tick
// and the owned-corpse waiver: a bleeding body cannot board (see D1 above), the isle corpse does
// not waive the second fare, or the bleed survives the Chapel return. The single mechanics are
// linked (transport.test.ts:86, local-story/transport.test.ts:439, c5_bleed.test.ts:226).
test('D1: bleed, Flee west, board while bleeding, die on the isle, cross free for the corpse', (t) => {
  // Regression pin: seed [19, 2, 3, 4] reaches HP 2 on a refreshing hit at 65400 and Flees west.
  const a = story(t, [19, 2, 3, 4], 'fey_touched');
  const body = a.w.body,
    apple = ID['item/apple_01'],
    hound = ID['population/fen_hounds/slot1/member'];
  // Entry ferry_landing (cartridge.json); apple_01 on village_green (items/apple_01.json).
  a.move('north', 'north');
  a.press('take', [apple]);
  a.move('south', 'south', 'south', 'south', 'east');
  a.press('attack', [hound]);
  // First round 150 later (combat interval): a positive fen_hound hit, 1 damage, opens bleeding
  // with its first tick due at +100 (bleeds/bleeding.json tick_every).
  a.tick();
  assert.equal(a.w.state.clock, 64950);
  assert.equal(a.hp(), 9);
  assert.deepEqual(
    [a.w.state.bleeds![body]!.active, a.w.state.bleeds![body]!.next_tick_at],
    [true, 65050],
  );
  while (a.hp()! > 2) a.tick();
  // Regression pin: the 65400 round hits for the last 1 HP and refreshes the end to 65700.
  assert.deepEqual([a.w.state.clock, a.hp()], [65400, 2]);
  const bleed = a.w.state.bleeds![body]!;
  assert.deepEqual([bleed.active, bleed.ends_at, bleed.next_tick_at], [true, 65700, 65450]);
  a.press('flee');
  assert.equal(a.holder(body), ID['room/reed_bank']); // regression pin: the west draw
  // Clock held: the walk and boarding happen before the 65450 tick.
  a.move('north', 'north', 'west');
  assert.equal(a.w.state.clock, 65400);
  // Step 4: the D1 route preconditions, each with the pointer message.
  assert.equal(a.w.state.bleeds![body]!.active, true, D1);
  assert.equal(a.hp(), 2, D1);
  const ferry = ID['detail/boathouse/ferry'];
  assert.equal(a.offer('board_ferry', [ferry])?.available, true, D1);
  const boarded = a.send('board_ferry', [ferry], {
    route: ref('transport', 'fen_outbound'),
    quoted_fare: 5,
  });
  assert.equal(boarded.kind, 'accepted', D1);
  assert.deepEqual(
    [a.resource(body, 'pennies'), a.resource(ID['npc/sedge'], 'pennies')],
    [15, 5],
    D1,
  );
  assert.equal(a.holder(body), ID['room/fen_isle_landing'], D1);
  // Ticks at 65450 (HP 1) and 65550 (HP 0): death on the isle; the corpse stays there holding the
  // apple; the same body returns to chapel_nave at HP 10 with the bleed closed.
  a.tick();
  assert.deepEqual(
    [a.w.state.clock, a.hp(), a.holder(body)],
    [65450, 1, ID['room/fen_isle_landing']],
  );
  a.tick();
  assert.equal(a.w.state.clock, 65550);
  assert.deepEqual([a.holder(body), a.hp()], [ID['room/chapel_nave'], 10]);
  assert.equal(a.w.state.bleeds![body]!.active, false);
  const corpse = a.holder(apple)!;
  assert.equal(a.holder(corpse), ID['room/fen_isle_landing']);
  assert.equal(a.w.state.created![corpse]!.origin.kind, 'death');
  // Chapel to the boathouse through the open chapel_door; the notice now waives the fare.
  a.move('south', 'south', 'south', 'south', 'south', 'west');
  const notice = a.view().notices!.find((d) => d.id === ferry)!.transport!;
  assert.deepEqual([notice.fare, notice.charge, notice.waived], [5, 0, true]);
  a.press('board_ferry', [ferry], { route: ref('transport', 'fen_outbound'), quoted_fare: 5 });
  assert.deepEqual(
    [a.holder(body), a.resource(body, 'pennies')],
    [ID['room/fen_isle_landing'], 15],
  );
  a.press('take', [apple]);
  assert.equal(a.holder(apple), body);
  a.press('return_ferry', [ID['detail/fen_isle_landing/ferry']], {
    route: ref('transport', 'fen_return'),
    quoted_fare: 0,
  });
  assert.deepEqual(
    [a.holder(body), a.resource(body, 'pennies'), a.resource(ID['npc/sedge'], 'pennies')],
    [ID['room/boathouse'], 15, 5],
  );
});

// Breaks: a hound death leaves Wren following or credits missing_child while she is separated
// (S5 planted-defect item 3), Rejoin is offered away from her, the fatal round leaves the Night
// Marsh attempt active, or retry keeps the failed attempt's id or route cursor.
test('family 4: a pack death separates Wren and fails the watch; Rejoin and retry restart cleanly', (t) => {
  // Regression pin: seed [19, 2, 3, 4] kills the watcher at 65550 and the retry Flee draws west.
  const a = story(t, [19, 2, 3, 4], 'fey_touched');
  const npc = (k: string) => ID[`npc/${k}`]!;
  const body = a.w.body,
    wren = npc('wren'),
    bones = ID['detail/hound_run/gnawed_bones'];
  // The v042 route to the escort (r9c_custody_terminal family 2's path).
  a.press('elspeth', [npc('elspeth')]);
  a.choose('accept');
  a.move('north', 'north');
  a.press('take', [ID['item/fox_drawing']]);
  a.move('south', 'south');
  a.press('a_elspeth_report', [npc('elspeth')]);
  a.choose('report');
  a.move('south', 'south');
  a.press('study_tracks', [ID['detail/reed_bank/tracks']]);
  a.move('south', 'south');
  a.press('a_vesper_meeting', [npc('vesper')]);
  a.choose('meet_wren');
  a.press('b_vesper_riddle', [npc('vesper')]);
  a.choose('answer', 'LANTERN');
  a.press('a_wren_escort', [wren]);
  a.choose('rescue');
  const escort = () => a.w.state.escorts![a.w.character]!.status;
  assert.equal(escort(), 'following');
  // fox_hollow north to mire_crossing, north to reed_bank, east to hound_run; Wren follows.
  a.move('north', 'north', 'east');
  assert.equal(a.holder(wren), ID['room/hound_run']);
  a.press('begin_marsh_watch', [bones], { transition: 'start' });
  const watch = () => Object.values(a.w.state.expeditions!)[0]!;
  const failed = watch();
  assert.deepEqual([failed.status, failed.cursor], ['active', 0]);
  while (a.holder(body) === ID['room/hound_run']) a.tick();
  assert.deepEqual(
    [a.w.state.clock, a.holder(body), a.hp()],
    [65550, ID['room/chapel_nave'], 10], // death@1: chapel_nave, restore HP 10
  );
  assert.deepEqual([escort(), a.holder(wren)], ['separated', ID['room/hound_run']]);
  assert.deepEqual([watch().status, watch().attempt_id], ['failed', failed.attempt_id]);
  // The escort route to Elspeth while separated: no rescue credit, no Rejoin away from Wren.
  a.move('south', 'south', 'south', 'south', 'south');
  assert.equal(a.holder(body), ID['room/ferry_landing']);
  assert.equal(a.offer('a_elspeth_rescue', [npc('elspeth')])?.available, false);
  assert.equal(a.offer('b_wren_rejoin', [wren]), undefined);
  a.move('south', 'south', 'east');
  a.press('b_wren_rejoin', [wren]);
  a.choose('rejoin');
  assert.equal(escort(), 'following');
  a.press('retry_marsh_watch', [bones], {
    transition: 'restart',
    quest_instance_id: failed.quest_instance_id,
    attempt_id: failed.attempt_id,
  });
  const retry = watch();
  assert.deepEqual([retry.status, retry.cursor], ['active', 0]);
  assert.equal(retry.quest_instance_id, failed.quest_instance_id);
  assert.notEqual(retry.attempt_id, failed.attempt_id);
  // The retry reopens the pack fight; Flee west is the route's first edge (regression pin).
  a.press('flee');
  const walked = [[a.holder(body), watch().cursor]];
  for (const d of ['west', 'south', 'north', 'east']) {
    a.move(d);
    walked.push([a.holder(body), watch().cursor]);
  }
  assert.deepEqual(walked, [
    [ID['room/reed_bank'], 1],
    [ID['room/willow_shade'], 2],
    [ID['room/drowned_oak'], 3],
    [ID['room/willow_shade'], 4],
    [ID['room/reed_bank'], 5],
  ]);
  assert.equal(watch().attempt_id, retry.attempt_id);
  // Rejoined, the same walk to Elspeth now offers the rescue.
  a.move('north', 'north');
  assert.equal(a.holder(wren), ID['room/ferry_landing']);
  assert.equal(a.offer('a_elspeth_rescue', [npc('elspeth')])?.available, true);
});
