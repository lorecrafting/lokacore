// E2 families 1-2 on the frozen synthetic cartridge (r9c_interactions), through the real kernel:
// identity, custody and trade; the Ring/Silence fork and the final acknowledgement. Standing
// integration scenario (E2 brief acceptance 4-5): each break it would catch is also killed by a
// focused same-layer test, linked per step. Expected values come from the cartridge files and
// protocol/fixtures/r9c_interactions_ids.json, never from a kernel run.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step, type World } from '../src/index.ts';
import type { DefinitionRef } from '../src/contracts.gen.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { resolve as words } from '../src/commands/target.ts';
import { key } from '../src/foundation/compose.ts';
import { value } from '../src/mechanics/fact.ts';
import { read } from './read.ts';

const pin = read('protocol/fixtures/r9c_interactions_hash.json');
const ids: Record<string, string> = read('protocol/fixtures/r9c_interactions_ids.json');
const load = (canonical: string) => {
  const hash = createHash('sha256').update(canonical).digest('hex');
  const artifact = `{"cartridge":${canonical},"content_hash":"${hash}"}`;
  return loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
};
const loaded = load(pin.canonical);
assert.ok(loaded.ok);
const cartridge = loaded.cartridge;
const ref = (kind: string, k: string) =>
  ({ cartridge_id: 'r9c_interactions', cartridge_version: '0.0.1', kind, key: k }) as DefinitionRef;
const item = (k: string) => ids[`item/${k}`]!;
const npc = (k: string) => ids[`npc/${k}`]!;

// One player with a fen_born start (road_born would grant haggle and skip the lesson).
function player() {
  let w: World = newWorld(
    cartridge as never,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  let n = 0;
  // No family 1-2 command authors a draw: RNG is unchanged by every one, accepted or refused.
  const run = (
    action_key: string,
    target_ids: string[] = [],
    input = {},
    expected = 'accepted',
  ) => {
    const invocation_id = `eeeeeeee-2222-4222-8222-${String(++n).padStart(12, '0')}`;
    const id = identify('s2', w.character, {
      invocation_id,
      actor_id: w.character,
      action_key,
      target_ids,
      input,
    });
    assert.equal(id.kind, 'identified');
    const command = resolve(w, id as never);
    const s =
      'kind' in command
        ? { world: w, decision: command }
        : step(w, command, n, action_key as never);
    const d = s.decision;
    assert.equal(d.kind === 'rejected' ? d.error.code : d.kind, expected, JSON.stringify(d));
    if (d.kind === 'rejected') assert.equal(s.world, w);
    assert.deepEqual(s.world.state.rng, w.state.rng);
    w = s.world;
    return d as any;
  };
  const p = {
    get w() {
      return w;
    },
    set w(next: World) {
      w = next;
    },
    run,
    view: () => gameView(w),
    move: (...directions: string[]) =>
      directions.forEach((direction) => run('move', [], { direction })),
    choose: (choice_id: string, answer?: string) =>
      run('choose', [], {
        continuation_id: gameView(w).choice!.continuation_id,
        choice_id,
        ...(answer && { answer }),
      }),
    next: () => {
      const { scene, index } = gameView(w).scene!;
      return run('continue', [], { scene, line: index });
    },
    fact: (name: string) => value(w, w.character, ref('fact', name)),
    holder: (id: string) => w.state.containers[id as never],
    pennies: (entity: string) =>
      w.state.resources![
        key({ entity_id: entity, kind: 'resource', resource: ref('resource', 'pennies') } as never)
      ]!.value,
    offered: (action_key: string) =>
      gameView(w).notices?.some((d) =>
        d.actions?.some((a) => a.action_key === action_key && a.available),
      ) ?? false,
  };
  p.run('choose_ancestry', [], { ancestry: 'fen_born' });
  return p;
}

// Breaks (shared; see the linked focused tests): a candidate list out of code-point order or a
// touch moving the wrong apple (play.test.ts:248, target.test.ts:87); a lesson or quote not
// charged as authored (practical_skills.test.ts:123, commerce.test.ts:79/:97); a Put past capacity
// or a dropped identity (put.test.ts:17, containment.test.ts:457); Wick binding other IDs
// (infirmary.test.ts:19 lowest-ID harvest, :108 stale exact custody); Knock writing state (d10_knowledge.test.ts); Where reading the
// live room (knowledge_composition.test.ts:7).
test('family 1: identity, custody and trade on r9c keep every ID and literal', () => {
  const p = player();
  const body = p.w.body;
  const room = (k: string) => ids[`room/${k}`];
  // Read: the notice's readable text key at the entry.
  assert.deepEqual(p.run('read', [ids['detail/ferry_landing/notice']!]).narration, [
    { key: 'readable.notice' },
  ]);
  p.move('north', 'west');
  // Haggle lesson: 2 pennies to Peg (peg_haggle lesson_payment; peg resource_starts 20).
  assert.deepEqual([p.pennies(body), p.pennies(npc('peg'))], [20, 20]);
  p.run('peg_haggle', [npc('peg')]);
  p.choose('learn');
  assert.deepEqual([p.pennies(body), p.pennies(npc('peg'))], [18, 22]);
  assert.equal(p.view().skills?.find((s) => s.skill.key === 'haggle')?.acquired, true);
  // Quote max(1, floor(5*9/10)) = 4; a stale 5 refuses; 4 moves the same satchel ID.
  const peg = p.view().entities.find((e) => e.id === npc('peg'))!;
  assert.deepEqual(peg.shop!.find((o) => o.item_id === item('satchel'))!.buy, {
    price: 4,
    available: true,
  });
  p.run('buy', [npc('peg'), item('satchel')], { quoted_price: 5 }, 'invalid_state');
  p.run('buy', [npc('peg'), item('satchel')], { quoted_price: 4 });
  assert.deepEqual([p.pennies(body), p.pennies(npc('peg'))], [14, 26]);
  assert.equal(p.holder(item('satchel')), body);
  // Where from the Green answers Peg's last observed room.
  p.move('east', 'north');
  assert.deepEqual(p.run('where', [npc('peg')]).location, {
    target_id: npc('peg'),
    status: 'last_seen',
    room_id: room('chandler'),
    at: 64800,
  });
  // Matching nouns: ordered candidates; touch takes exactly apple_02.
  assert.deepEqual(words(p.w, p.w.character, 'apple'), {
    kind: 'ambiguous',
    candidate_ids: [item('apple_03'), item('apple_01'), item('apple_02')],
  });
  p.run('take', [item('apple_02')]);
  assert.deepEqual(
    ['apple_01', 'apple_02', 'apple_03'].map((k) => p.holder(item(k))),
    [room('village_green'), body, room('village_green')],
  );
  // Put four into the satchel (capacity 4), each ID kept.
  const four = ['apple_01', 'apple_02', 'apple_03', 'fox_drawing'];
  for (const k of ['apple_01', 'apple_03', 'fox_drawing']) p.run('take', [item(k)]);
  for (const k of four) p.run('put', [item(k), item('satchel')]);
  assert.deepEqual(
    four.map((k) => p.holder(item(k))),
    four.map(() => item('satchel')),
  );
  // Fenwort at Willow Shade; a fifth Put refuses with no change.
  p.move('south', 'south', 'south', 'south', 'west');
  for (const k of ['01', '02', '03', '04']) p.run('take', [item(`fenwort_${k}`)]);
  p.run('put', [item('fenwort_01'), item('satchel')], {}, 'invalid_state');
  // Barrier: close from the steps; the move refuses; Knock to Aldric only narrates.
  p.move('east', 'north', 'north', 'north', 'north', 'north', 'north');
  p.run('close', [], { direction: 'north' });
  assert.equal(p.view().exits.find((e) => e.direction === 'north')!.door!.state, 'closed');
  p.run('move', [], { direction: 'north' }, 'exit_closed');
  const knock = p.run('knock', [], { direction: 'north' });
  assert.deepEqual([knock.narration, knock.delta.ops], [[{ key: 'knock.chapel.answered' }], []]);
  // The nave face is reachable only through this door; it reads the state written outside.
  p.run('open', [], { direction: 'north' });
  p.move('north');
  assert.equal(p.view().exits.find((e) => e.direction === 'south')!.door!.state, 'open');
  // Wick: lowest held herb IDs (fenwort_04 2d52 < _02 aecc < _03 bb12) for Wick's lowest
  // bandages (bandage_10 192a < _01 1d97 < _09 2de1), protocol.md B5; fen_born -2 +1 = -1.
  p.run('a_wick_offer', [npc('wick')]);
  p.choose('accept');
  p.run('b_wick_turn_in', [npc('wick')]);
  p.choose('exchange');
  assert.deepEqual(
    ['fenwort_04', 'fenwort_02', 'fenwort_03', 'fenwort_01'].map((k) => p.holder(item(k))),
    [npc('wick'), npc('wick'), npc('wick'), body],
  );
  assert.deepEqual(
    ['bandage_10', 'bandage_01', 'bandage_09', 'bandage_02'].map((k) => p.holder(item(k))),
    [body, body, body, npc('wick')],
  );
  assert.deepEqual([p.fact('infirmary_contribution'), p.fact('priory_fen_axis')], [1, -1]);
});

// The legal v042 route (e1_paths.ts search, childReturn rescued, bell up to the belfry).
function belfry() {
  const p = player();
  p.run('elspeth', [npc('elspeth')]);
  p.choose('accept');
  p.run('close_choice'); // the hub stays open after an answer (loka-x6t.5): Leave the conversation
  p.move('north', 'north');
  p.run('take', [item('fox_drawing')]);
  p.move('south', 'south');
  p.run('a_elspeth_report', [npc('elspeth')]);
  p.choose('report');
  p.move('south', 'south');
  p.run('study_tracks', [ids['detail/reed_bank/tracks']!]);
  p.move('south', 'south');
  p.run('a_vesper_meeting', [npc('vesper')]);
  p.choose('meet_wren');
  p.run('b_vesper_riddle', [npc('vesper')]);
  p.choose('answer', 'LANTERN');
  p.run('a_wren_escort', [npc('wren')]);
  p.choose('rescue');
  p.move('north', 'north', 'north', 'north');
  p.run('a_elspeth_rescue', [npc('elspeth')]);
  p.choose('rescued');
  p.move('north', 'north', 'north', 'north', 'north');
  p.run('a_aldric_offer', [npc('aldric')]);
  p.choose('accept');
  p.move('up', 'up');
  return p;
}

const quest = (p: ReturnType<typeof player>, k: string) =>
  p.view().journal.find((q) => q.quest.key === k)?.state;
const MEMORY = [
  'memory_village_ending',
  'memory_fox_fate',
  'memory_chapter_1_guild_tilt',
  'story_point_prologue_completed',
];
const FORKS = [
  [
    'ring_bell',
    'silence_bell',
    'prior',
    true,
    'bell_rung',
    3,
    ['rescued', 'stilled', 'prior', 'rescued_prior'],
  ],
  [
    'silence_bell',
    'ring_bell',
    'fox',
    false,
    'bell_silenced',
    2,
    ['rescued', 'free', 'fox', 'rescued_fox'],
  ],
] as const;

// Breaks (shared): one terminal overwriting the other or Ring admitted after Silence
// (missing_child_bell.test.ts:136/:297); the ending written before the final shown line
// (missing_child_finale.test.ts:143).
test('family 2: one belfry snapshot forks into exactly one terminal and one acknowledged ending', () => {
  const p = belfry();
  assert.equal(p.view().place.title.key, 'room.belfry.title');
  assert.deepEqual(
    [p.fact('village_child_status'), p.fact('chapel_allegiance'), p.fact('chapel_bell_rung')],
    ['rescued', 'unknown', false],
  );
  assert.deepEqual(
    [quest(p, 'missing_child'), quest(p, 'bell_of_ashmere')],
    ['resolved', 'active'],
  );
  assert.deepEqual([p.offered('ring_bell'), p.offered('silence_bell')], [true, true]);
  const snapshot = structuredClone(p.w);
  for (const [act, other, allegiance, rung, scene, lines, memory] of FORKS) {
    p.w = structuredClone(snapshot);
    p.run(act, [ids['detail/belfry/bell']!]);
    assert.deepEqual([p.fact('chapel_allegiance'), p.fact('chapel_bell_rung')], [allegiance, rung]);
    assert.equal(quest(p, 'bell_of_ashmere'), 'resolved');
    for (let line = 1; line <= lines; line++) {
      assert.deepEqual([p.view().scene?.scene.key, p.view().scene?.index], [scene, line]);
      p.next();
    }
    assert.equal(p.view().scene, undefined);
    // Back in the belfry, the other terminal is neither offered nor admitted when forged.
    assert.equal(p.offered(other), false);
    p.run(other, [ids['detail/belfry/bell']!], {}, 'invalid_state');
    p.move('down', 'down', 'south', 'south', 'south');
    assert.deepEqual(
      MEMORY.map(p.fact),
      MEMORY.map(() => 'unreached'),
    );
    p.run(`begin_epilogue_rescued_${allegiance}`, [ids['detail/village_green/market_cross']!]);
    for (const line of [1, 2, 3]) {
      assert.equal(p.view().scene?.index, line);
      assert.equal(p.fact('story_point_prologue_completed'), 'unreached');
      p.next();
    }
    assert.deepEqual(MEMORY.map(p.fact), memory);
  }
});
