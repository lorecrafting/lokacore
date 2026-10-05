import assert from 'node:assert/strict';
import { test } from 'node:test';
import { trainingWorld, trainingRef, learned, wield } from './training_fixture.ts';
import { attack, elapsed, command, hp, rat, ref, positioned } from './combat_fixture.ts';
import { step, gameView, type World } from '../src/index.ts';
import { status } from '../src/mechanics/skills.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { key } from '../src/foundation/compose.ts';

const pools = (w: World) => [
  level(w, w.body, resourceRef(w, 'hp')),
  level(w, rat(w), resourceRef(w, 'hp')),
  w.state.rng,
];
const teacher = (w: World) => w.entityIds[ref(w, 'npc', 'teacher')];
const penny = (w: World) => [
  level(w, w.body, resourceRef(w, 'pennies')),
  level(w, teacher(w), resourceRef(w, 'pennies')),
];
function talk(w: World, n = 1) {
  const next = step(
    w,
    command(w, { type: 'talk', actor_id: w.character, target_id: teacher(w) }, n),
    n,
  );
  assert.equal(next.decision.kind, 'accepted', JSON.stringify(next.decision));
  return next.world;
}
const choose = (w: World, n = 2) =>
  step(
    w,
    command(
      w,
      {
        type: 'choose',
        actor_id: w.character,
        continuation_id: gameView(w).choice!.continuation_id,
        choice_id: 'learn' as never,
      },
      n,
    ),
    n,
  );

// Breaks: teaching rejects unqualified actors, recharges repeats, or omits conserved lesson/gift consequences.
test('unqualified learning persists distinct acquisition and one-time exact payment and custody', () => {
  let w = trainingWorld(9);
  const opened = talk(w);
  assert.deepEqual(penny(opened), [10, 0]);
  const one = choose(opened);
  assert.equal(one.decision.kind, 'accepted', JSON.stringify(one.decision));
  w = one.world;
  assert.deepEqual(penny(w), [6, 4]);
  assert.equal(w.state.containers[w.entityIds[ref(w, 'item', 'sword')]], w.body);
  assert.deepEqual(status(w, w.character, trainingRef(w, 'skill', 'swords' as never), { n: 0 }), {
    acquired: true,
    qualified: false,
    usable: false,
  });
  const two = choose(talk(w, 3), 4);
  assert.equal(two.decision.kind, 'accepted', JSON.stringify(two.decision));
  w = two.world;
  assert.deepEqual(penny(w), [2, 8]);
  assert.deepEqual(status(w, w.character, trainingRef(w, 'skill', 'dodge' as never), { n: 0 }), {
    acquired: true,
    qualified: false,
    usable: false,
  });
  const repeated = talk(w, 5);
  const refused = choose(repeated, 6);
  assert.deepEqual(refused.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
  assert.equal(refused.world, repeated);
});

// Breaks: a stale, unfunded or too-heavy lesson applies only part of acquisition/payment/gift.
test('lesson rechecks teacher, exact original gift, money and carry atomically', () => {
  const w = talk(trainingWorld());
  const gift = w.entityIds[ref(w, 'item', 'sword')];
  const cases: [string, (w: World) => World][] = [
    [
      'remote teacher',
      (w) => ({
        ...w,
        state: {
          ...w.state,
          containers: {
            ...w.state.containers,
            [teacher(w)]: w.roomIds[ref(w, 'room', 'ferry_landing')],
          },
        },
      }),
    ],
    [
      'missing gift',
      (w) => ({
        ...w,
        state: { ...w.state, containers: { ...w.state.containers, [gift]: w.body } },
      }),
    ],
    ['insufficient payer', (w) => hpMoney(w, w.body, 3)],
    ['recipient overflow', (w) => hpMoney(w, teacher(w), 999)],
    [
      'carry overflow',
      (w) => ({
        ...w,
        cartridge: { ...w.cartridge, world: { ...w.cartridge.world, carry: { max_grams: 499 } } },
      }),
    ],
  ];
  for (const [name, mutate] of cases) {
    const before = mutate(w);
    const next = choose(before);
    assert.equal(next.decision.kind, 'rejected', name + JSON.stringify(next.decision));
    assert.equal(next.world, before, name);
  }
});
function hpMoney(w: World, entity_id: World['body'], value: number): World {
  return {
    ...w,
    state: {
      ...w.state,
      resources: {
        ...w.state.resources,
        [key({ kind: 'resource', resource: resourceRef(w, 'pennies'), entity_id })]: {
          value,
          at: 0,
        },
      },
    },
  };
}

// Breaks: held or unlearned/unqualified weapons replace the unarmed profile; Attack draws early.
test('only qualified learned wield custody selects the sword at the due opportunity', () => {
  for (const [name, w, ratHp] of [
    ['unlearned', wield(trainingWorld()), 5],
    ['unqualified', wield(learned(trainingWorld(9), 'swords')), 5],
    ['held', carried(learned(trainingWorld(), 'swords')), 5],
    ['qualified wield', wield(learned(trainingWorld(), 'swords')), 3],
  ] as const) {
    const first = attack(w);
    assert.equal(first.decision.kind, 'accepted', name);
    assert.deepEqual(pools(first.world), [10, 6, [1, 2, 3, 4]], name);
    const next = elapsed(first.world, 150);
    assert.equal(next.decision.kind, 'accepted', JSON.stringify(next.decision));
    assert.deepEqual(pools(next.world), [9, ratHp, [12295, 1029, 1029, 25165824]], name);
  }
});

// Breaks: inclusive defense roll, ineligible draws or continuing block/damage after dodge prevention.
test('strict dodge then shield block stop later draws on independent S3/S4 answers', () => {
  for (const chance of [41, 40]) {
    let w = wield(
      wield(learned(learned(trainingWorld(10, chance), 'swords'), 'dodge')),
      'off_hand',
    );
    const next = elapsed(attack(w).world, 150);
    assert.equal(next.decision.kind, 'accepted', JSON.stringify(next.decision));
    assert.deepEqual(pools(next.world), [
      10,
      3,
      chance === 41 ? [25179138, 12295, 540162, 2107404] : [27274249, 25704967, 31982592, 12605441],
    ]);
    if (next.decision.kind === 'accepted')
      assert.deepEqual(
        next.decision.events
          .filter((e) => e.payload.type === 'attack_result')
          .map((e) => e.payload),
        [
          {
            type: 'attack_result',
            encounter_id: Object.keys(next.world.state.encounters!)[0],
            attacker_id: w.body,
            target_id: rat(w),
            hit: true,
            loss: 3,
          },
          {
            type: 'attack_result',
            encounter_id: Object.keys(next.world.state.encounters!)[0],
            attacker_id: rat(w),
            target_id: w.body,
            hit: false,
            loss: 0,
            prevented_by: chance === 41 ? 'dodge' : 'block',
          },
        ],
      );
  }
});

// Breaks: nonstanding defenders prevent the waking hit, or armed death permits revived retaliation.
test('sleeping cannot defend and lethal armed hits close before retaliation', () => {
  const armed = wield(
    wield(learned(learned(trainingWorld(10, 100), 'swords'), 'dodge')),
    'off_hand',
  );
  const first = elapsed(attack(armed).world, 150);
  const sleeping = positioned(first.world, 'sleeping');
  const next = elapsed({ ...sleeping, state: { ...sleeping.state, rng: [1, 2, 3, 4] } }, 300, 3);
  assert.equal(next.decision.kind, 'accepted');
  assert.equal(level(next.world, armed.body, resourceRef(armed, 'hp')), 8);
  const lethal = elapsed(attack(hp(armed, rat(armed), 3)).world, 150);
  assert.equal(lethal.decision.kind, 'accepted');
  assert.deepEqual(pools(lethal.world), [10, 0, [7, 0, 1026, 12288]]);
  assert.equal(Object.keys(lethal.world.state.created ?? {}).length, 1);
  if (lethal.decision.kind === 'accepted')
    assert.deepEqual(
      lethal.decision.events.map((e) => e.payload.type),
      ['attack_result', 'entity_died', 'fact_changed'],
    );
});

function carried(w: World): World {
  const item = w.entityIds[ref(w, 'item', 'sword')];
  return { ...w, state: { ...w.state, containers: { ...w.state.containers, [item]: w.body } } };
}
