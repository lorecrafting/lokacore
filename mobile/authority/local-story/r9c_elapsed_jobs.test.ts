// E2 S3 durable proof: families 3 and 5 on the frozen r9c_interactions artifact through the
// real authority and SQLite. Every saved step is cold-reopened from its file before the next
// consumer, then its invocation is replayed and must change nothing. Literals cite content
// under cartridges/r9c_interactions/ (owner decision (d): update in place).
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
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory } from './authority.ts';
import { receipts, sqliteHost } from './__tests__/elapsed-host.test.ts';

const pin = read('protocol/fixtures/r9c_interactions_hash.json');
const ID: Record<string, string> = read('protocol/fixtures/r9c_interactions_ids.json');
const ref = (kind: string, name: string) =>
  ({
    cartridge_id: 'r9c_interactions',
    cartridge_version: '0.0.1',
    kind,
    key: name,
  }) as unknown as DefinitionRef;

function story(t: TestContext) {
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  const initial = newWorld(
    loaded.cartridge as never,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const releases = [{ fresh: initial, content_hash: pin.sha256 }] as const;
  const dir = mkdtempSync(join(tmpdir(), 'loka-r9c-s3-'));
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
  const invoke = (action_key: string, target_ids: string[], input: object) => {
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
    assert.equal((reply.decision as any).kind, 'accepted', JSON.stringify(reply.decision));
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
    press(action_key: string, target_ids: string[] = [], input: object = {}) {
      const o = offered(view()).find(
        (o) => o.action_key === action_key && key(o.target_ids) === key(target_ids),
      );
      assert.equal(o?.available, true, action_key);
      return invoke(action_key, target_ids, input);
    },
    move(direction: string) {
      assert.equal(view().exits.find((e) => e.direction === direction)?.available, true);
      return a.press('move', [], { direction });
    },
    invoke,
    buy(item: string) {
      const row = view()
        .entities.find((e) => e.id === ID['npc/peg'])!
        .shop!.find((s) => s.item_id === ID[item])!;
      assert.equal(row.buy!.available, true);
      return invoke('buy', [ID['npc/peg'], ID[item]], { quoted_price: row.buy!.price });
    },
    service(name: string) {
      const o = view()
        .entities.find((e) => e.id === ID['npc/maud'])!
        .services!.find((s) => s.service.key === name)!;
      return a.press(o.action.action_key, [ID['npc/maud']], {
        service: o.service,
        quoted_price: o.price,
      });
    },
    choose(choice_id: string) {
      const c = view().choice!;
      const o = c.choices.find((o) => o.choice_id === choice_id)!;
      assert.equal(o.available, true, choice_id);
      return invoke('choose', [], {
        continuation_id: c.continuation_id,
        choice_id,
        ...(o.patrol && { patrol: o.patrol }),
      });
    },
    elapse(until: number) {
      const from = s.world().state.clock;
      const evidence = { expected_run_id: s.runId(), from, until };
      const reply = s.elapsed(evidence);
      assert.equal(reply.kind, 'saved', JSON.stringify(reply));
      if (reply.kind === 'saved') assert.equal((reply.decision as any).kind, 'accepted');
      assert.equal(s.world().state.clock, until);
      reopen();
      // A resent window after reopen settles nothing twice.
      const disk = rows();
      s.elapsed({ ...evidence, expected_run_id: s.runId() });
      assert.deepEqual(rows(), disk);
    },
  };
  a.press('choose_ancestry', [], { ancestry: 'fey_touched' });
  return a;
}
type Story = ReturnType<typeof story>;

const resource = (w: World, holder: string, name: string) =>
  w.state.resources![key({ kind: 'resource', resource: ref('resource', name), entity_id: holder })]
    .value;
// Player, Peg, Maud: 20 + 20 + 10 = 50 (resources.json, npcs/peg.json, npcs/maud.json).
const ledger = (w: World) => {
  const l = [w.body, ID['npc/peg'], ID['npc/maud']].map((h) => resource(w, h, 'pennies'));
  assert.equal(l[0] + l[1] + l[2], 50);
  return l;
};
const liquid = (w: World, item: string) => {
  const l = w.state.liquids![ID[item]];
  return [l.kind?.key ?? null, l.quantity];
};
const fuel = (a: Story) =>
  ['item/torch', 'item/lamp_oil'].map(
    (item) =>
      [...a.view().inventory, ...a.view().equipment!.flatMap((s) => (s.item ? [s.item] : []))].find(
        (e) => e.id === ID[item],
      )!.fuel!.remaining,
  );
const fact = (w: World, name: string) => value(w, w.character, ref('fact', name));
const quest = (a: Story, name: string) => a.view().journal.find((q) => q.quest.key === name)?.state;
const dream = (a: Story) => a.view().notices!.find((n) => n.bed)!.dream!;

// Breaks: a committed shop, service, liquid, fuel, Rest or dream row fails to cold-reopen at its
// exact value, a replay re-applies a payment or the final ack, or elapsed settlement committed
// during the open dream checkpoint loses fuel or a due job.
test('family 3 durable: ledger, liquid, fuel and dream reopen and replay at every step', (t) => {
  const a = story(t);
  a.move('north');
  a.move('west');
  for (const item of ['item/torch', 'item/lamp_oil', 'item/waterskin', 'item/spare_waterskin'])
    a.buy(item);
  assert.deepEqual(ledger(a.w), [7, 33, 10]); // npcs/peg.json buy 3 + 2 + 4 + 4
  a.move('east');
  a.press('fill', [ID['detail/well_lane/well'], ID['item/waterskin']]);
  a.press('drink', [ID['item/waterskin']]);
  a.press('pour', [ID['item/waterskin'], ID['item/spare_waterskin']]);
  assert.deepEqual(
    [liquid(a.w, 'item/waterskin'), liquid(a.w, 'item/spare_waterskin')],
    [
      [null, 0],
      ['water', 3],
    ],
  );
  a.press('wear', [ID['item/torch']]);
  a.press('ignite', [ID['item/torch']]);
  a.elapse(65400);
  a.press('refuel', [ID['item/torch'], ID['item/lamp_oil']]);
  assert.deepEqual(fuel(a), [7200, 6600]); // 14400 - 600 burned (items/torch.json rate 1)
  a.move('east');
  a.service('lantern_room');
  a.service('lantern_meal');
  assert.deepEqual(ledger(a.w), [1, 33, 16]);
  a.move('up');
  a.press('rest');
  for (let line = 1; line <= 3; line++) {
    const d = dream(a);
    a.press(d.action!.action_key, [], { scene: d.scene, line: d.index });
  }
  a.elapse(68400);
  assert.deepEqual(fuel(a), [4200, 6600]); // 14400 - 3600 burned
  // Every genesis population job, due 68400, completed while the dream is open.
  for (const [label, id] of Object.entries(ID))
    if (/^population\/\w+\/job$/.test(label))
      assert.equal(a.w.state.jobs![id].status, 'completed', label);
  assert.equal(dream(a).index, 4);
  assert.equal(fact(a.w, 'dream_seen'), false); // facts.json default
  a.press('stand');
  a.move('down');
  a.service('lantern_ale');
  assert.deepEqual(ledger(a.w), [0, 33, 17]);
  assert.deepEqual(liquid(a.w, 'item/lantern_ale_cask'), ['ale', 3]);
  assert.equal(resource(a.w, ID['npc/maud'], 'lantern_meals'), 3);
  a.move('up');
  a.press('rest');
  const c = dream(a).choice!,
    o = c.choices.find((o) => o.choice_id === 'wake')!;
  assert.equal(o.available, true);
  a.invoke(o.action_key!, [], {
    continuation_id: c.continuation_id,
    choice_id: 'wake',
    dream: o.dream,
  });
  assert.equal(fact(a.w, 'dream_seen'), false);
  assert.equal(quest(a, 'a_room_at_the_lantern'), 'active');
  const ack = dream(a);
  a.press(ack.action!.action_key, [], { scene: ack.scene, line: ack.index });
  assert.equal(fact(a.w, 'dream_seen'), true);
  assert.equal(quest(a, 'a_room_at_the_lantern'), 'resolved');
  assert.deepEqual(a.w.state.rng, [1, 2, 3, 4]);
});

// Breaks: a paused patrol row or the crow wander jobs committed during the detour fail to
// reopen exactly, or a replayed Rejoin or final join credits twice.
test('family 5 durable: patrol detour through crow jobs reopens and completes at four', (t) => {
  const a = story(t);
  const patrol = () => Object.values(a.w.state.patrols ?? {})[0]!;
  const talk = (choice_id: string) => {
    a.press('tobin_watch', [ID['npc/tobin']]);
    a.choose(choice_id);
  };
  for (const d of ['north', 'north', 'north', 'east']) a.move(d);
  talk('start');
  for (const d of ['west', 'south']) {
    talk('continue');
    a.move(d);
  }
  talk('continue');
  a.move('south');
  const paused = patrol();
  assert.deepEqual([paused.status, paused.credit.length], ['paused', 2]);
  a.elapse(68400);
  for (const job of ['population/crow_green_1/job', 'population/crow_green_2/job'])
    assert.equal(a.w.state.jobs![ID[job]].status, 'completed');
  a.move('north');
  a.move('east');
  assert.deepEqual(patrol(), paused);
  talk('rejoin');
  for (const d of ['west', 'north', 'east', 'west', 'south', 'east']) {
    talk('continue');
    a.move(d);
  }
  assert.deepEqual(
    patrol().credit,
    ['north_gate', 'village_green', 'watch_post', 'east_gate'].map((r) => ID[`room/${r}`]),
  );
  assert.equal(patrol().status, 'completed');
  assert.equal(fact(a.w, 'watch_gate_trusts_player'), true);
  assert.equal(quest(a, 'watch_rounds'), 'resolved');
});

// Breaks: an equal-time deer sight and population boundary, or the fatal hit after flight,
// commit a row that cold reopen rejects, or replaying the Attack draws or kills again.
test('family 5 durable: deer flight at the boundary and the fatal hit reopen exactly', (t) => {
  const a = story(t);
  for (const d of ['south', 'south', 'south']) a.move(d);
  a.elapse(68100);
  a.move('west');
  const sight = Object.values(a.w.state.jobs!).find((j) => j.sight)!;
  assert.equal(sight.sight!.member_id, ID['population/oak_deer/slot1/deer']);
  assert.equal(sight.due_time, 68400); // the shared population boundary
  a.elapse(68400);
  const oak = ID['population/oak_deer/slot1/deer'];
  assert.equal(a.w.state.containers[oak], ID['room/willow_shade']);
  assert.equal(
    a.w.state.containers[ID['population/willow_deer/slot1/deer']],
    ID['room/drowned_oak'],
  );
  a.move('north');
  a.press('attack', [oak]);
  a.elapse(68550);
  assert.equal(resource(a.w, oak, 'hp'), 0);
  const corpse = Object.values(a.w.state.created!).find(
    (c) => c.origin.kind === 'death' && c.origin.victim_id === oak,
  )!;
  assert.equal(a.w.state.containers[ID['population/oak_deer/slot1/hide']], corpse.id);
  assert.equal(
    Object.values(a.w.state.population_slots!).find((s) => s.member_id === oak)!.replacement_due,
    68550 + 172800, // populations/oak_deer.json replacement_delay
  );
  // Regression pin, two draws (hit and damage), as in the kernel scenario.
  assert.deepEqual(a.w.state.rng, [12295, 1029, 1029, 25165824]);
  a.elapse(68700);
  assert.equal(a.w.state.containers[ID['population/oak_deer/slot1/hide']], corpse.id);
});

// Breaks: wall time spent on the ancestry screen is credited after the choice (or across a
// reopen), or the driver faults on the ancestry screen because the kernel refuses that elapsed.
test('world time starts at the ancestry choice: no credit on the picker or across its reopen', (t) => {
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  const initial = newWorld(
    loaded.cartridge as never,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const releases = [{ fresh: initial, content_hash: pin.sha256 }] as const;
  const dir = mkdtempSync(join(tmpdir(), 'loka-r9c-entry-'));
  const clock = { wall: 0, mono: 0 };
  let p = sqliteHost(join(dir, 'save.db'), clock);
  t.after(() => {
    p.sql.close();
    rmSync(dir, { recursive: true });
  });
  const open = () => {
    const s = openStory(p.db, releases, p.host);
    if (s.kind !== 'open') throw new Error('r9c save did not open');
    return s;
  };
  let s = open();
  s.pulse('resume', s.runId());
  Object.assign(clock, { wall: 120000, mono: 120000 });
  assert.deepEqual(s.pulse('active', s.runId()), { kind: 'ready' });
  assert.equal(s.world().state.clock, 64800);
  assert.equal(receipts(p.sql), 0);
  // Close on the picker; reopen an hour later in a new process (monotonic restarts at 0).
  p.sql.close();
  Object.assign(clock, { wall: 3600000, mono: 0 });
  p = sqliteHost(join(dir, 'save.db'), clock);
  s = open();
  assert.deepEqual(s.pulse('resume', s.runId()), { kind: 'ready' });
  assert.equal(s.world().state.clock, 64800);
  // Ten more minutes on the picker with no pulse: the choice's reservation must discard them.
  Object.assign(clock, { wall: 4200000, mono: 600000 });
  const chosen = s.invoke({
    invocation_id: 'cccccccc-0000-4000-8000-000000000001',
    actor_id: initial.character,
    action_key: 'choose_ancestry',
    target_ids: [],
    input: { ancestry: 'fey_touched' },
  });
  assert.equal(chosen.kind === 'saved' && (chosen.decision as any).kind, 'accepted');
  Object.assign(clock, { wall: 4260000, mono: 660000 });
  for (let n = 0; n < 4 && s.pulse('active', s.runId()).kind !== 'ready'; n++);
  assert.equal(s.world().state.clock, 64800 + 3000);
});
