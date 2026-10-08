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
      // Every scenario ends before 80000; a changed route fails here instead of looping on.
      assert.ok(until < 80000, `no due job or past the pinned route at ${from}`);
      const evidence = { expected_run_id: s.runId(), from, until };
      const reply = s.elapsed(evidence);
      assert.equal(reply.kind, 'saved', JSON.stringify(reply));
      if (reply.kind === 'saved') assert.equal((reply.decision as any).kind, 'accepted');
      assert.equal(s.world().state.clock, until);
      reopen();
      const disk = rows();
      assert.equal(s.elapsed({ ...evidence, expected_run_id: s.runId() }).kind, 'saved');
      assert.deepEqual(rows(), disk);
      return (reply as any).decision;
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
  // Round 1 at +150: a fen_hound hit (1 damage) opens bleeding, first tick at +100 (tick_every).
  a.tick();
  assert.equal(a.w.state.clock, 64950);
  assert.equal(a.hp(), 9);
  assert.deepEqual(
    [a.w.state.bleeds![body]!.active, (a.w.state.bleeds![body] as any).next_tick_at],
    [true, 65050],
  );
  while (a.hp()! > 2) a.tick();
  // Regression pin: the 65400 round hits for the last 1 HP and refreshes the end to 65700.
  assert.deepEqual([a.w.state.clock, a.hp()], [65400, 2]);
  const bleed = a.w.state.bleeds![body] as any;
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
  // Ticks at 65450 (HP 1) and 65550 (HP 0): isle death; same body to chapel_nave, HP 10.
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
// Marsh attempt active, or retry keeps the failed attempt's id. (A retry keeping the old route
// cursor is not sensed here: the watch fails at cursor 0; see kernel/ts/test/c6_expedition.test.ts
// and local-story/c6_expedition.test.ts.)
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
  // cursor 0 at death: stale-cursor retry is linked to the two c6_expedition tests, not caught here.
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
  // cursor is 0 either way (failed at 0); a stale-cursor retry is caught by the c6_expedition tests.
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

// Breaks (shared; single mechanics linked in the PR coverage table): a finite custody hop mints,
// reuses or renames an ID (careful harvest, exchange, Bandage, Eat, drowning corpse, Chapel
// recovery, crow carry); a consumed item leaves the consumed holder; the drowning corpse holds
// other than the body's actual roots; the crow acquisition credits the player (its item_acquired
// names the body, not the crow).
test('families 6-7: lessons, finite herbs, Bandage, dive, drowning, recovery and the crow keep IDs', (t) => {
  // hill_folk: dark_sight (cartridge.json) to Take in the dark well_bottom, DEX 10, INT 10.
  // Regression pin: seed [19, 2, 3, 4] lands one bleeding hound hit at 64950, then Flees east.
  const a = story(t, [19, 2, 3, 4], 'hill_folk');
  const npc = (k: string) => ID[`npc/${k}`]!;
  const item = (k: string) => ID[`item/${k}`]!;
  const body = a.w.body,
    consumed = a.w.consumed!,
    coin = item('old_coin');
  const pennies = () => [a.resource(body, 'pennies'), a.resource(npc('sedge'), 'pennies')];
  const held = () =>
    Object.entries(a.w.state.containers)
      .filter(([id, at]) => at === body && a.w.entities[id as never]?.kind === 'item')
      .map(([id]) => id)
      .sort();
  const start = new Set(Object.keys(a.w.entities));
  // New entities other than population births (night_target growth is C3, not loot).
  const minted = () =>
    Object.keys(a.w.entities).filter(
      (id) => !start.has(id) && a.w.state.created?.[id as never]?.origin.kind !== 'spawned',
    );
  // Board 5p to Sedge (transports/fen_outbound.json); swim is free, herbalism 2p; return 0p.
  a.move('west');
  a.press('board_ferry', [ID['detail/boathouse/ferry']], {
    route: ref('transport', 'fen_outbound'),
    quoted_fare: 5,
  });
  assert.deepEqual(pennies(), [15, 5]);
  a.press('sedge_swim', [npc('sedge')]);
  a.choose('learn');
  assert.deepEqual(pennies(), [15, 5]);
  a.press('sedge_herbalism', [npc('sedge')]);
  a.choose('learn');
  assert.deepEqual(pennies(), [13, 7]);
  assert.deepEqual(
    a
      .view()
      .skills!.filter((s) => s.acquired)
      .map((s) => s.skill.key),
    ['herbalism', 'swim'],
  );
  a.press('return_ferry', [ID['detail/fen_isle_landing/ferry']], {
    route: ref('transport', 'fen_return'),
    quoted_fare: 0,
  });
  assert.deepEqual(pennies(), [13, 7]);
  // Eat apple_01 (items/apple_01.json edible): terminal custody, never offered again.
  a.move('east', 'north', 'north');
  a.press('take', [item('apple_01')]);
  a.press('eat', [item('apple_01')]);
  assert.equal(a.holder(item('apple_01')), consumed);
  assert.equal(a.offer('eat', [item('apple_01')]), undefined);
  // Careful harvest takes the two lowest fenwort IDs, ordinary the next (code-point order of
  // the ids oracle: fenwort_07 0dae < _05 18b2 < _12 1d7c).
  a.move('south', 'south', 'south', 'south', 'west');
  const patch = ID['detail/willow_shade/fenwort_patch']!;
  a.press('gather_carefully', [patch], { method: 'careful' });
  assert.deepEqual(held(), [item('fenwort_07'), item('fenwort_05')].sort());
  a.press('harvest', [patch]);
  // Wick's exchange: these three herbs for his three lowest bandages (bandage_10 192a < _01
  // 1d97 < _09 2de1; quests/infirmary_herbs.json).
  a.move('east', 'north', 'north', 'north', 'north', 'north', 'north', 'north');
  a.press('a_wick_offer', [npc('wick')]);
  a.choose('accept');
  a.press('b_wick_turn_in', [npc('wick')]);
  a.choose('exchange');
  for (const k of ['fenwort_07', 'fenwort_05', 'fenwort_12'])
    assert.equal(a.holder(item(k)), npc('wick'));
  assert.deepEqual(held(), [item('bandage_10'), item('bandage_01'), item('bandage_09')].sort());
  // One bleeding hound hit at 64950 (HP 9), then unlearned Bandage refuses with nothing spent.
  a.move('south', 'south', 'south', 'south', 'south', 'south', 'south', 'east');
  a.press('attack', [ID['population/fen_hounds/slot1/member']]);
  a.tick();
  assert.deepEqual([a.w.state.clock, a.hp(), a.w.state.bleeds![body]!.active], [64950, 9, true]);
  const generation = a.w.state.bleeds![body]!.generation;
  const before = encode(a.w.state as never);
  const refused = a.send('bandage', [item('bandage_10')], { effect_generation: generation });
  assert.equal(refused.kind, 'rejected');
  assert.equal(encode(a.w.state as never), before);
  a.press('flee');
  assert.equal(a.holder(body), ID['room/adder_nest']); // regression pin: the east draw
  // Wick teaches Bandage (DEX 10 qualifies); one tick at 65050 (HP 8), then the cure keeps HP.
  a.move('west', 'west', 'north', 'north', 'north', 'north', 'north', 'north', 'north');
  a.press('wick_bandage', [npc('wick')]);
  a.choose('learn');
  a.tick();
  assert.deepEqual([a.w.state.clock, a.hp()], [65050, 8]);
  a.press('bandage', [item('bandage_10')], { effect_generation: generation });
  assert.deepEqual(
    [a.holder(item('bandage_10')), a.w.state.bleeds![body]!.active],
    [consumed, false],
  );
  // Dive from well_shaft (world.water entry_cost 10) and Take the coin from well_bottom.
  a.move('south', 'south', 'south', 'south', 'down');
  const mv = a.resource(body, 'mv')!;
  a.move('down');
  assert.equal(a.resource(body, 'mv'), mv - 10);
  a.press('take', [coin]);
  const roots = held();
  assert.deepEqual(roots, [item('bandage_01'), item('bandage_09'), coin].sort());
  // One drowning at entry + 6000 (world.water duration); the corpse holds the body's roots.
  while (a.holder(body) === ID['room/well_bottom']) a.tick();
  assert.deepEqual([a.w.state.clock, a.holder(body), a.hp()], [71050, ID['room/chapel_nave'], 10]);
  const corpse = a.holder(coin)!;
  assert.equal(a.holder(corpse), ID['room/well_bottom']);
  assert.deepEqual(minted(), [corpse]); // only the corpse is new
  const recovery = a.view().corpse_recovery!;
  assert.deepEqual(
    recovery.map((r) => [r.corpse_id, r.room_id, r.roots.map((x) => x.id).sort()]),
    [[corpse, ID['room/well_bottom'], roots]],
  );
  assert.equal(a.send('recover_corpse', [corpse], {}).kind, 'accepted');
  assert.deepEqual(held(), roots);
  // Crows: wait on the Green until crow_green_1 is home (hourly wander), Drop, Take: no carry.
  a.move('south', 'south', 'south');
  const crow = ID['population/crow_green_1/slot1/member']!;
  while (a.holder(crow) !== ID['room/village_green']) a.tick();
  assert.equal(a.w.state.clock, 72000);
  a.press('drop', [coin]);
  a.press('take', [coin]);
  a.tick();
  assert.deepEqual([a.w.state.clock, a.holder(coin)], [72150, body]);
  // Drop again: the crow acquires the same coin at +150 (scavenge interval), credited to the crow.
  a.press('drop', [coin]);
  const acquired = a.tick();
  assert.deepEqual([a.w.state.clock, a.holder(coin)], [72300, crow]);
  assert.deepEqual(
    acquired.events
      .filter((e: any) => e.payload.type === 'item_acquired')
      .map((e: any) => e.payload),
    [{ type: 'item_acquired', item_id: coin, holder_id: crow }],
  );
  // Shoo on the Green releases the coin here; no second Shoo is offered.
  a.press('shoo', [crow]);
  assert.equal(a.holder(coin), ID['room/village_green']);
  assert.equal(a.offer('shoo', [crow]), undefined);
  // Take and Drop once more: the original coin rides the corridor into the open nest.
  a.press('take', [coin]);
  a.press('drop', [coin]);
  const nest = item('crow_nest');
  while (a.holder(coin) !== nest) a.tick();
  assert.equal(a.holder(nest), ID['room/oak_branches']);
  assert.deepEqual(minted(), [corpse]);
  for (const k of ['apple_01', 'bandage_10']) assert.equal(a.holder(item(k)), consumed);
});
