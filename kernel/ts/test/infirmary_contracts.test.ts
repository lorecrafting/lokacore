import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decode } from '../src/foundation/canonical.ts';
import { validate } from '../src/foundation/validate.ts';
import { sampler, infirmary, prefix, ref, patch, fresh } from './infirmary_fixture.ts';
const qkey = `${prefix}:quest/herbs`;
const roomkey = `${prefix}:room/mine`;
const value: any = decode(sampler.bundle(infirmary).canonical);
const quest = value.quests[qkey];
const { seam } = value.rooms[roomkey].details;
const { careful: _c, tool: _t, ...harvest } = seam.harvest; // optional fields; careful is pinned in practical_skills_contracts
const detail = { ...seam, harvest };

// Breaks: missing stock/fact/participant or malformed bounded quantities cross the typed boundary.
test('harvest, exchange and retirement retain required identities and bounded stock', () => {
  const harvest = { type: 'harvest', actor_id: fresh.character, target_id: patch };
  const retire = {
    op: 'quest.retire',
    writer_group: 0,
    instance_id: 'aaaaaaaa-1111-4222-8333-444444444444',
    quest: ref('quest', 'herbs'),
    scope: { kind: 'player', character_id: fresh.character },
  };
  for (const [name, valid, path] of [
    ['CommandPayload', harvest, []],
    ['DeltaOp', retire, []],
    ['QuestDefinition', quest, ['exchange']],
    ['InspectableDetail', detail, ['harvest']],
  ] as const) {
    assert.deepEqual(validate(name, valid), []);
    const object = path.length ? (valid as any)[path[0]] : valid;
    for (const field of Object.keys(object)) {
      const changed = structuredClone(valid);
      const target = path.length ? (changed as any)[path[0]] : changed;
      delete (target as any)[field];
      assert.ok(validate(name, changed).length, `${name}.${field}`);
    }
  }
  for (const quantity of [0, 65])
    assert.ok(
      validate('QuestDefinition', { ...quest, exchange: { ...quest.exchange, quantity } }).length,
    );
  for (const items of [[], Array(65).fill(detail.harvest.items[0])])
    assert.ok(
      validate('InspectableDetail', { ...detail, harvest: { ...detail.harvest, items } }).length,
    );
});

// Breaks: a forged family, reward holder, overlap, stock or contribution bound loads despite invalid funding.
test('loader independently rejects invalid authored exchange and harvest stock', () => {
  const cases = [
    (c: any) => {
      c.quests[qkey].exchange.outgoing[1] = c.quests[qkey].exchange.outgoing[0];
    },
    (c: any) => {
      c.quests[qkey].exchange.incoming[0] = c.quests[qkey].exchange.outgoing[0];
    },
    (c: any) => {
      c.items[`${prefix}:item/bandage_01`].location = { in: 'room', room: ref('room', 'mine') };
    },
    (c: any) => {
      c.items[`${prefix}:item/ore_01`].mass_grams = 0;
    },
    (c: any) => {
      c.quests[qkey].exchange.quantity = 7; // six ores in stock
    },
    (c: any) => {
      c.quests[qkey].exchange.increment = 3; // contribution maximum is 2
    },
    (c: any) => {
      delete c.facts[`${prefix}:fact/contribution`];
    },
    (c: any) => {
      delete c.rooms[roomkey].details.seam;
    },
  ];
  for (const change of cases)
    assert.equal(
      sampler.load((c) => {
        infirmary(c);
        change(c);
      }).ok,
      false,
      String(change),
    );
});
