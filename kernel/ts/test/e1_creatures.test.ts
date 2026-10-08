import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Command, DecisionResult } from '../src/contracts.gen.ts';
import type { World } from '../src/index.ts';
import { hash } from '../src/foundation/canonical.ts';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost, type CaseHost } from './e1_case_host.ts';
import { replayCase } from './e1_cases.ts';
import { ending } from './e1_paths.ts';
import { maudsCellar } from './e1_maud.ts';
import { creatures, creatureWitnesses } from './e1_creatures.ts';
import { reactionWitnesses } from './e1_obligations.ts';
import { hourOf } from '../src/mechanics/calendar.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const bytes = new TextEncoder().encode(
  `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`,
);
const loaded = admitCandidate(bytes);
const source = {
  source_sha: '1'.repeat(40),
  check_hash: '2'.repeat(64),
  policy_hash: '3'.repeat(64),
};
const P = (kind: string, key: string) => `/${kind}s/ashmere_missing_child@0.0.42:${kind}/${key}`;
const ref = (kind: string, key: string) => ({
  cartridge_id: 'ashmere_missing_child',
  cartridge_version: '0.0.42',
  key,
  kind,
});
type Step = { before: World; after: World; command: Command; decision: DecisionResult };
// Test-only mutation of a cloned committed step.
type Loose = any;
const witness = (s: Step) => creatureWitnesses(s.before, s.after, s.decision);
const reactions = (s: Step) => reactionWitnesses(s.before, s.after, s.decision);

// Runs one route on a fresh real-SQLite save and keeps the first step crediting each named path.
function capture(name: string, route: (a: CaseHost) => unknown, wanted: string[], see = witness) {
  const dir = mkdtempSync(join(tmpdir(), `loka-e1-${name}-`));
  const a = caseHost(loaded, join(dir, 'save.db'), join(dir, 'case.jsonl'), undefined, {
    case_id: name,
    source,
    fault_schedule: [],
  });
  const steps = new Map<string, Step>(),
    seen = new Set<string>();
  try {
    a.watch((before, after, command, decision) => {
      const paths = see({ before, after, command, decision });
      for (const p of paths) seen.add(p);
      for (const p of wanted)
        if (paths.includes(p) && !steps.has(p))
          steps.set(p, structuredClone({ before, after, command, decision }));
    });
    const result = route(a);
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    const replay = replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source);
    return { result, steps, seen: [...seen].sort(), replayed: replay.obligations as string[] };
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
}

// Plants one violation in a clone of a real step; the named path must then disappear.
function planted(
  step: Step,
  path: string,
  cases: Record<string, (s: Loose) => void>,
  see = witness,
) {
  assert.ok(see(step).includes(path), `control: ${path}`);
  for (const [name, plant] of Object.entries(cases)) {
    const s = structuredClone(step) as Loose;
    plant(s);
    assert.equal(see(s).includes(path), false, `${name} still credits ${path}`);
  }
}
const ops = (s: Loose, op: string) => s.decision.delta.ops.filter((o: Loose) => o.op === op);
const drop = (s: Loose, pick: (o: Loose) => boolean) => {
  const before = s.decision.delta.ops.length;
  s.decision.delta.ops = s.decision.delta.ops.filter((o: Loose) => !pick(o));
  assert.equal(s.decision.delta.ops.length, before - 1, 'drop exactly one op');
};
const event = (s: Loose, type: string) =>
  s.decision.events.find((e: Loose) => e.payload.type === type).payload;

const HUNTED = [
  ...['crow_branches', 'crow_green_1', 'crow_green_2', 'crow_oak'].map((k) => P('population', k)),
  ...['fen_hounds', 'oak_deer', 'orchard_deer', 'willow_deer'].map((k) => P('population', k)),
  ...['crow_branches', 'crow_green', 'crow_oak', 'fen_hound'].map((k) => P('npc', k)),
  ...['oak_deer', 'orchard_deer', 'willow_deer'].map((k) => P('npc', k)),
  ...['crow_corpse', 'deer_corpse', 'deer_hide', 'hound_corpse', 'hound_pelt', 'player_corpse'].map(
    (k) => P('item', k),
  ),
  P('bleed', 'bleeding'),
].sort();

// Breaks: a spawned member's death, its corpse, loot, slot replacement or the hound bleed is credited
// without its exact committed receipt and state transition.
test('E1 creature deaths witness only exact corpse, loot, population and bleed evidence', () => {
  const hound = P('item', 'hound_corpse'),
    player = P('item', 'player_corpse'),
    bleeding = P('bleed', 'bleeding');
  const { result, steps, seen, replayed } = capture('creatures', creatures, [
    hound,
    player,
    bleeding,
  ]);
  assert.deepEqual(result, { crow_corpse: 4, deer_corpse: 3, hound_corpse: 1, player_corpse: 2 });
  assert.deepEqual(seen, HUNTED);
  assert.deepEqual(
    HUNTED.filter((p) => !replayed.includes(p)),
    [],
  );
  const death = steps.get(hound)!,
    corpse = ops(death, 'entity.create')[0].identity,
    victim = corpse.origin.victim_id,
    pelt = ops(death, 'entity.transfer').find((o: Loose) => o.source_id === victim).entity_id,
    slot = (s: Loose) => ops(s, 'population.slot')[0],
    held = (s: Loose, w: 'before' | 'after') =>
      Object.values(s[w].state.population_slots).find(
        (row: Loose) => row.member_id === victim,
      ) as Loose;
  const room = event(death, 'entity_died').room_id,
    elsewhere = (s: Loose) => s.before.roomIds['ashmere_missing_child@0.0.42:room/orchard'];
  assert.deepEqual(witness(death), [
    hound,
    P('population', 'fen_hounds'),
    P('npc', 'fen_hound'),
    P('item', 'hound_pelt'),
  ]);
  planted(death, hound, {
    'event id': (s) =>
      (s.decision.events.find((e: Loose) => e.payload.type === 'entity_died').id = victim),
    'event type': (s) => (event(s, 'entity_died').type = 'attack_result'),
    'event victim': (s) => (event(s, 'entity_died').victim_id = pelt),
    'event corpse': (s) => (event(s, 'entity_died').corpse_id = pelt),
    'created row': (s) =>
      (s.after.state.created[corpse.id].definition = ref('item', 'deer_corpse')),
    'corpse room': (s) => (s.after.state.containers[corpse.id] = elsewhere(s)),
    'victim room': (s) => (s.before.state.containers[victim] = elsewhere(s)),
    'bundle corpse': (s) => {
      ops(s, 'entity.create')[0].identity.definition = ref('item', 'rat_corpse');
      s.after.state.created[corpse.id].definition = ref('item', 'rat_corpse');
    },
  });
  for (const path of [P('population', 'fen_hounds'), P('npc', 'fen_hound')])
    planted(death, path, {
      'bundle npc': (s) => (s.before.state.created[victim].definition = ref('npc', 'oak_deer')),
      'slot member': (s) => (slot(s).expected.member_id = held(s, 'before').member_id = pelt),
      'slot generation': (s) => (slot(s).expected.generation = held(s, 'before').generation = 2),
      'replacement due': (s) =>
        (slot(s).value.replacement_due = held(s, 'after').replacement_due += 1),
      'slot receipt': (s) => drop(s, (o) => o.op === 'population.slot'),
    });
  planted(death, P('item', 'hound_pelt'), {
    'loot origin': (s) => (s.before.state.created[pelt].origin.kind = 'authored'),
    'loot member': (s) => (s.before.state.created[pelt].origin.member_id = pelt),
    'bundle item': (s) =>
      (s.before.cartridge.population_bundles[
        'ashmere_missing_child@0.0.42:population_bundle/fen_hounds'
      ].item = ref('item', 'deer_hide')),
    'loot held': (s) => (s.before.state.containers[pelt] = room),
    'loot in corpse': (s) => (s.after.state.containers[pelt] = room),
    'loot receipt': (s) => drop(s, (o) => o.op === 'entity.transfer' && o.entity_id === pelt),
  });

  const died = steps.get(player)!;
  assert.deepEqual(witness(died), [player]);
  planted(died, player, {
    'not the player': (s) => (s.before.body = pelt),
  });

  const bled = steps.get(bleeding)!,
    bleed = (s: Loose) => ops(s, 'bleed.transition').find((o: Loose) => o.value.active),
    row = (s: Loose, w: 'before' | 'after') => s[w].state.bleeds?.[bleed(s).body_id];
  const hit = (s: Loose) =>
    s.decision.events.find(
      (e: Loose) =>
        e.payload.type === 'attack_result' &&
        e.payload.attacker_id === bleed(s).value.source_id &&
        e.payload.target_id === bleed(s).body_id,
    ).payload;
  assert.equal(bleed(bled).expected, null);
  planted(bled, bleeding, {
    refresh: (s) => {
      bleed(s).expected = { ...bleed(s).value };
      s.before.state.bleeds = { [bleed(s).body_id]: bleed(s).value };
    },
    inactive: (s) => {
      const o = bleed(s);
      o.value = s.after.state.bleeds[o.body_id] = { active: false, generation: 1 };
    },
    'unknown bleed': (s) => (s.before.cartridge.bleeds = {}),
    'no hit': (s) =>
      (s.decision.events = s.decision.events.filter(
        (e: Loose) => e.payload.type !== 'attack_result',
      )),
    'hit type': (s) => (hit(s).type = 'entity_died'),
    'hit attacker': (s) => (hit(s).attacker_id = victim),
    'hit target': (s) => (hit(s).target_id = victim),
    missed: (s) => (hit(s).hit = false),
    'no loss': (s) => (hit(s).loss = 0),
    'static source': (s) => delete s.before.state.created[bleed(s).value.source_id],
    'source effect': (s) =>
      delete s.before.cartridge.npcs['ashmere_missing_child@0.0.42:npc/fen_hound'].attack
        .on_positive_hit,
    'before row': (s) =>
      (s.before.state.bleeds = { [bleed(s).body_id]: { active: false, generation: 0 } }),
    'after row': (s) => (row(s, 'after').ends_at += 1),
    'ends at': (s) => {
      bleed(s).value.ends_at += 1;
      row(s, 'after').ends_at += 1;
    },
    'next tick': (s) => {
      bleed(s).value.next_tick_at += 1;
      row(s, 'after').next_tick_at += 1;
    },
  });
});

// Breaks: a reaction is credited without its exact committed effects in one writer group, or its
// `when` is judged on a boundary state instead of the state its delivery read (the bell reactions
// hold at neither boundary). Answers from cartridges/ashmere_missing_child/reactions/*.json.
test('E1 reactions need every exact apply effect and a when holding in their read state', () => {
  const R = (k: string) => P('reaction', k),
    [a, b, c, d9, start] = [
      'a_resolve_bell',
      'b_lost_before_meeting',
      'c_resolve_silence',
      'd9_suppress_hounds',
      'start_search',
    ].map(R) as [string, string, string, string, string],
    when = (r: string, n: number) => [
      `${r}/when/root`,
      ...Array.from({ length: n }, (_, i) => `${r}/when/root/items/${i}`),
    ];
  const expected = {
    a: [a, `${a}/apply/0`, ...when(a, 2)],
    b: [b, `${b}/apply/0`, `${b}/apply/1`, ...when(b, 5)],
    c: [c, `${c}/apply/0`, ...when(c, 2)],
    d9: [d9, `${d9}/apply/0`, `${d9}/when/root`],
    start: [start, `${start}/apply/0`],
  };
  const prior = capture(
    'lost-prior',
    (h) => ending(h, 'lost', 'prior', 'stilled'),
    [start, a],
    reactions,
  );
  const lost = [...expected.a, ...expected.b, ...expected.d9, ...expected.start].sort();
  assert.deepEqual(prior.seen, lost);
  assert.deepEqual(
    lost.filter((p) => !prior.replayed.includes(p)),
    [],
  );
  const fox = capture('rescued-fox', (h) => ending(h, 'rescued', 'fox', 'free'), [c], reactions);
  const silenced = [...expected.c, ...expected.start].sort();
  assert.deepEqual(fox.seen, silenced);
  assert.deepEqual(
    silenced.filter((p) => !fox.replayed.includes(p)),
    [],
  );

  const rule = (s: Loose, k: string) =>
      s.before.cartridge.reactions[`ashmere_missing_child@0.0.42:reaction/${k}`],
    quest = (s: Loose, w: 'before' | 'after', k: string) =>
      Object.values(s[w].state.quests).find((q: Loose) => q.quest.key === k) as Loose,
    questId = (s: Loose, k: string) =>
      Object.keys(s.after.state.quests).find((i) => s.after.state.quests[i].quest.key === k)!,
    fact = (s: Loose, k: string) =>
      Object.keys(s.after.state.facts).find((f) => f.includes(`"${k}"`))!,
    assign = (s: Loose, k: string) => ops(s, 'fact.assign').find((o: Loose) => o.fact.key === k),
    changed = (s: Loose, k: string) =>
      s.decision.events.find((e: Loose) => e.payload.fact?.key === k).payload;
  const bell = prior.steps.get(a)!,
    report = prior.steps.get(start)!;
  for (const path of expected.a)
    planted(
      bell,
      path,
      {
        'read state': (s) =>
          drop(s, (o) => o.op === 'fact.assign' && o.fact.key === 'chapel_bell_rung'),
        'when holds only after': (s) =>
          (rule(s, 'a_resolve_bell').when.root.items[1].state = 'resolved'),
        'no open instance': (s) => {
          quest(s, 'before', 'bell_of_ashmere').state = 'failed';
          rule(s, 'a_resolve_bell').when.root.items.pop();
        },
        'no instance': (s) => delete s.before.state.quests[questId(s, 'bell_of_ashmere')],
        'cause time': (s) => {
          const cause = s.decision.events.find(
              (e: Loose) => e.payload.fact?.key === 'chapel_bell_rung',
            ),
            h = hourOf(s.before.cartridge, cause.logical_time);
          cause.logical_time += 6 * 3600;
          assert.notEqual(hourOf(s.before.cartridge, cause.logical_time), h);
          rule(s, 'a_resolve_bell').when.root.items[0] = { op: 'time_window', from: h, to: h + 1 };
        },
        'transition instance': (s) =>
          (ops(s, 'quest.transition').find((o: Loose) => o.to === 'resolved').instance_id =
            'other'),
        'transition to': (s) =>
          (ops(s, 'quest.transition').find((o: Loose) => o.to === 'resolved').to = 'failed'),
        'transition outcome': (s) =>
          (ops(s, 'quest.transition').find((o: Loose) => o.to === 'resolved').outcome = 'fox'),
        'after state': (s) => (quest(s, 'after', 'bell_of_ashmere').state = 'active'),
        'after outcome': (s) => (quest(s, 'after', 'bell_of_ashmere').outcome = 'fox'),
        'resolved event': (s) => (event(s, 'quest_resolved').outcome = 'fox'),
      },
      reactions,
    );
  for (const path of expected.b)
    planted(
      bell,
      path,
      {
        'two groups': (s) => (assign(s, 'village_child_status').writer_group += 2),
        'fail op': (s) => drop(s, (o) => o.op === 'quest.transition' && o.to === 'failed'),
        'fail state': (s) => (quest(s, 'after', 'missing_child').state = 'active'),
        'fail outcome': (s) => (quest(s, 'after', 'missing_child').outcome = 'rescued'),
        'assign op': (s) =>
          drop(s, (o) => o.op === 'fact.assign' && o.fact.key === 'village_child_status'),
        'assign value': (s) => (assign(s, 'village_child_status').value = 'rescued'),
        'assign unchanged': (s) => {
          assign(s, 'village_child_status').expected = 'lost';
          changed(s, 'village_child_status').old = 'lost';
        },
        'assign after': (s) => (s.after.state.facts[fact(s, 'village_child_status')] = 'missing'),
        'assign event': (s) => (changed(s, 'village_child_status').new = 'rescued'),
      },
      reactions,
    );
  for (const path of expected.start)
    planted(
      report,
      path,
      {
        'other outcome': (s) => (rule(s, 'start_search').on.outcome = 'lost'),
        'activate op': (s) => drop(s, (o) => o.op === 'quest.activate'),
        'activate quest': (s) =>
          (ops(s, 'quest.activate')[0].quest = ref('quest', 'bell_of_ashmere')),
        'prior instance': (s) => {
          const id = questId(s, 'missing_child');
          s.before.state.quests[id] = s.after.state.quests[id];
        },
        'not active': (s) => (quest(s, 'after', 'missing_child').state = 'resolved'),
        'other player': (s) => (quest(s, 'after', 'missing_child').scope.character_id = 'other'),
        'activated event': (s) => (event(s, 'quest_activated').instance_id = 'other'),
      },
      reactions,
    );

  const d9rule = (s: Loose) => rule(s, 'd9_suppress_hounds'),
    plan = (s: Loose, w: 'before' | 'after') =>
      s[w].state.population_plans[
        Object.keys(s[w].state.population_plans).find((k) => k.includes('"fen_hounds"'))!
      ],
    control = (s: Loose) => ops(s, 'population.control')[0];
  planted(bell, `${d9}/when/root`, { 'no when': (s) => delete d9rule(s).when }, reactions);
  for (const path of expected.d9)
    planted(
      bell,
      path,
      {
        'cause type': (s) => {
          for (const e of s.decision.events)
            if (e.payload.fact?.key === 'chapel_bell_rung') e.payload.type = 'fact_seen';
        },
        'other fact': (s) => {
          for (const e of s.decision.events)
            if (e.payload.type === 'fact_changed' && e.payload.fact.key === 'chapel_bell_rung')
              e.payload.fact = ref('fact', 'chapel_allegiance');
        },
        'other trigger': (s) =>
          (d9rule(s).on = {
            event: 'quest_resolved',
            quest: ref('quest', 'bell_of_ashmere'),
            outcome: 'fox',
          }),
        'when fails': (s) => (d9rule(s).when.root.equals = 'fox'),
        'no steps': (s) => (d9rule(s).apply = []),
        'other op': (s) => (d9rule(s).apply[0].op = 'population.release'),
        'no plan row': (s) =>
          delete s.before.state.population_plans[
            Object.keys(s.before.state.population_plans).find((k) => k.includes('"fen_hounds"'))!
          ],
        'already suppressed': (s) => {
          plan(s, 'before').suppression = plan(s, 'after').suppression;
          control(s).expected.suppression = plan(s, 'after').suppression;
        },
        'one plan already suppressed': (s) => {
          const other = Object.keys(s.before.state.population_plans).find(
            (k) => !k.includes('"fen_hounds"'),
          )!;
          s.before.state.population_plans[other].suppression = plan(s, 'after').suppression;
          d9rule(s).apply.push({ ...d9rule(s).apply[0], plan: JSON.parse(other) });
        },
        'cause id': (s) => {
          plan(s, 'after').suppression.cause_event_id = control(s).value.suppression.job_id;
          control(s).value.suppression.cause_event_id = control(s).value.suppression.job_id;
        },
        'ends at': (s) => {
          plan(s, 'after').suppression.ends_at += 1;
          control(s).value.suppression.ends_at += 1;
        },
        'control expected': (s) => (control(s).expected.next_wander_due += 1),
        'control value': (s) => (control(s).value.next_wander_due += 1),
        'control receipt': (s) => drop(s, (o) => o.op === 'population.control'),
      },
      reactions,
    );
});

// Breaks: an authored rat corpse is credited without its exact committed corpse transition.
test('E1 authored rat corpse needs its exact committed effects', () => {
  const rat = P('item', 'rat_corpse');
  const cellar = capture('mauds-cellar', maudsCellar, [rat]);
  assert.deepEqual(cellar.seen, [rat]);
  planted(cellar.steps.get(rat)!, rat, {
    'player corpse': (s) => {
      ops(s, 'entity.create')[0].identity.definition = ref('item', 'player_corpse');
      s.after.state.created[ops(s, 'entity.create')[0].identity.id].definition = ref(
        'item',
        'player_corpse',
      );
    },
  });
});
