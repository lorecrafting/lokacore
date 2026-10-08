// Breaks (each case): reopen accepts the named forged Chandler's Debt state row or receipt column.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  forgeRows,
  fresh,
  otherId,
  otherPlayer as other,
  type Stage,
} from './__tests__/chandlers-setup.test.ts';

type Rows = Parameters<Parameters<typeof forgeRows>[1]>[0];
type Story = Parameters<Parameters<typeof forgeRows>[1]>[1];
const one = (rows: Rows, section: string, pick: (value: any, key: string) => boolean) => {
  const keys = Object.keys(rows[section] ?? {}).filter((k) => pick(rows[section][k], k));
  assert.equal(keys.length, 1, section);
  return keys[0];
};
const job = (r: Rows) => r.jobs[one(r, 'jobs', (j) => !!j.quest_instance_id)];
const quest = (r: Rows) => r.quests[one(r, 'quests', () => true)];
const ref = (key: string) => ({
  cartridge_id: fresh.cartridge.manifest.id,
  cartridge_version: fresh.cartridge.manifest.version,
  key,
  kind: 'fact',
});
const character = fresh.character;
const trust = JSON.stringify({
  fact: ref('peg_trust'),
  kind: 'fact',
  scope: { character_id: character, kind: 'player' },
});
const tithe = JSON.stringify({
  fact: ref('priory_tithe_delivered'),
  kind: 'fact',
  scope: { kind: 'instance', world_context_id: fresh.context },
});
const ledger = (a: Story) => a.entity('item', 'tithe_ledger');
// The player's 20-penny purse and Aldric's coins (the only resource row on him).
const purse = (r: Rows, a: Story) =>
  r.resources[
    one(r, 'resources', (v, k) => JSON.parse(k).entity_id === a.world().body && v.value === 20)
  ];
const aldric = (r: Rows, a: Story) =>
  r.resources[one(r, 'resources', (_, k) => JSON.parse(k).entity_id === a.entity('npc', 'aldric'))];
const swap = (b: { entity_id: string }[]) =>
  ([b[0].entity_id, b[1].entity_id] = [b[1].entity_id, b[0].entity_id]);
// Rewrites one column of the stage's receipt whose command has `path` = `match`.
const column = (stage: Stage, set: string, path: string, match: string, value: string) =>
  forgeRows(stage, (_, a) => {
    a.sql
      .prepare(`UPDATE receipt SET ${set}=? WHERE json_extract(command,?)=?`)
      .run(value, path, match);
  });

// Each row: the condition the forgery breaks, then the forged save.
const cases: [string, () => string][] = [
  // unbound(): the offer is still open, so nothing of the obligation may be saved yet.
  [
    'an unaccepted obligation whose ledger the player holds',
    () =>
      forgeRows('offered', (r, a) => {
        r.containers[ledger(a)] = a.world().body;
      }),
  ],
  [
    'an unaccepted obligation with a due job',
    () =>
      forgeRows('offered', (r) => {
        (r.jobs ??= {})[otherId] = {
          actor_id: character,
          due_time: 237601,
          status: 'pending',
          job: { ...ref('chandlers_debt'), kind: 'quest' },
        };
      }),
  ],
  [
    'an unaccepted obligation whose outcome fact is pending',
    () =>
      forgeRows('offered', (r) => {
        (r.facts ??= {})[tithe] = 'pending';
      }),
  ],
  [
    'an unaccepted obligation with a trust penalty',
    () =>
      forgeRows('offered', (r) => {
        (r.facts ??= {})[trust] = -1;
      }),
  ],
  [
    'an unaccepted obligation with a changed purse',
    () =>
      forgeRows('offered', (r, a) => {
        purse(r, a).value = 25;
      }),
  ],
  [
    "an unaccepted obligation with changed Aldric's coins",
    () =>
      forgeRows('offered', (r, a) => {
        aldric(r, a).value = 5;
      }),
  ],
  // funds(): both balances are valid resource rows.
  [
    'an accepted obligation whose purse row lost its time',
    () =>
      forgeRows('accept', (r, a) => {
        delete purse(r, a).at;
      }),
  ],
  [
    "an accepted obligation whose Aldric's coins row lost its time",
    () =>
      forgeRows('accept', (r, a) => {
        delete aldric(r, a).at;
      }),
  ],
  // bound(): the quest, its acceptance and its due job agree.
  [
    'an accepted quest scoped to another player',
    () =>
      forgeRows('accept', (r) => {
        quest(r).scope = other;
      }),
  ],
  [
    'an accepted quest with swapped role bindings',
    () => forgeRows('accept', (r) => swap(quest(r).bindings)),
  ],
  [
    'an accepted quest with two due jobs',
    () =>
      forgeRows('accept', (r) => {
        r.jobs[otherId] = job(r);
      }),
  ],
  [
    'a due job for another quest instance',
    () =>
      forgeRows('accept', (r) => {
        job(r).quest_instance_id = otherId;
      }),
  ],
  [
    'a due job for another actor',
    () =>
      forgeRows('accept', (r) => {
        job(r).actor_id = other.character_id;
      }),
  ],
  [
    'a due job at another time',
    () =>
      forgeRows('accept', (r) => {
        job(r).due_time = 237602;
      }),
  ],
  [
    'a due job already completed before the deadline',
    () =>
      forgeRows('accept', (r) => {
        job(r).status = 'completed';
      }),
  ],
  [
    'a due job still pending after a kept deadline',
    () =>
      forgeRows('kept', (r) => {
        job(r).status = 'pending';
      }),
  ],
  [
    'a failed quest whose due job is pending before the deadline',
    () =>
      forgeRows('expire', (r, a) => {
        job(r).status = 'pending';
        a.sql.prepare('UPDATE head SET clock=?').run(237600);
      }),
  ],
  [
    'a quest still active after the deadline',
    () =>
      forgeRows('expire', (r) => {
        const q = quest(r);
        q.state = 'active';
        delete q.outcome;
        r.facts[tithe] = 'pending';
        delete r.facts[trust];
      }),
  ],
  [
    'an accepted obligation with a changed purse',
    () =>
      forgeRows('accept', (r, a) => {
        purse(r, a).value = 25;
      }),
  ],
  [
    "an accepted obligation with changed Aldric's coins",
    () =>
      forgeRows('accept', (r, a) => {
        aldric(r, a).value = 5;
      }),
  ],
  // settled(): the quest state matches its terminal choice or expiry.
  [
    'a turn-in with two resolved terminal choices',
    () =>
      forgeRows('deliver', (r) => {
        r.choices[otherId] = r.choices[one(r, 'choices', (c) => c.beat === 'a_aldric_debt')];
      }),
  ],
  [
    'an expired quest with another outcome',
    () =>
      forgeRows('expire', (r) => {
        quest(r).outcome = 'late';
      }),
  ],
  [
    'an expired quest with another outcome fact',
    () =>
      forgeRows('expire', (r) => {
        r.facts[tithe] = 'late';
      }),
  ],
  [
    'an expired quest with another trust value',
    () =>
      forgeRows('expire', (r) => {
        r.facts[trust] = -4;
      }),
  ],
  [
    'an accepted quest abandoned without a terminal choice',
    () =>
      forgeRows('accept', (r) => {
        quest(r).state = 'abandoned';
      }),
  ],
  [
    'an active quest whose outcome fact is not pending',
    () =>
      forgeRows('accept', (r) => {
        r.facts[tithe] = 'unoffered';
      }),
  ],
  [
    'an active quest with a trust penalty',
    () =>
      forgeRows('accept', (r) => {
        (r.facts ??= {})[trust] = -1;
      }),
  ],
  [
    'an active quest whose ledger is back with Peg',
    () =>
      forgeRows('accept', (r, a) => {
        r.containers[ledger(a)] = a.entity('npc', 'peg');
      }),
  ],
  // resolved(): the resolved quest matches its turn-in.
  [
    'a resolved quest whose outcome fact differs from its turn-in',
    () =>
      forgeRows('deliver', (r) => {
        r.facts[tithe] = 'late';
      }),
  ],
  [
    'a resolved quest whose ledger is not with Aldric',
    () =>
      forgeRows('deliver', (r, a) => {
        r.containers[ledger(a)] = a.world().body;
      }),
  ],
  [
    'a resolved quest with a trust penalty',
    () =>
      forgeRows('deliver', (r) => {
        (r.facts ??= {})[trust] = -1;
      }),
  ],
  // Receipt columns: the acceptance and expiry are this player's, in this save's scope.
  [
    'an accept receipt stored for another actor',
    () => column('accept', 'actor_id', '$.payload.choice_id', 'accept_on_time', other.character_id),
  ],
  [
    'an expiry receipt stored in another scope',
    () => column('expire', 'scope', '$.payload.type', 'elapsed', 'story/forged/scope'),
  ],
  [
    'an expiry receipt stored for another actor',
    () => column('expire', 'actor_id', '$.payload.type', 'elapsed', other.character_id),
  ],
  [
    'an expiry receipt stored under another command id',
    () => column('expire', 'command_id', '$.payload.type', 'elapsed', otherId),
  ],
];
for (const [name, forged] of cases)
  test(`reopen refuses ${name}`, () => assert.equal(forged(), 'save_corrupt'));

// Breaks: a stage the cases forge is itself refused, so every case passes for nothing.
test('every unforged stage reopens', () => {
  for (const stage of ['offered', 'accept', 'late', 'expire', 'deliver', 'kept'] as const)
    assert.equal(
      forgeRows(stage, () => {}),
      'open',
      stage,
    );
});
