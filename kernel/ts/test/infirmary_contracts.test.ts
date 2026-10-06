import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { validate } from '../src/foundation/validate.ts';
import { encode } from '../src/foundation/canonical.ts';
import { loadCartridge, INSTALLED } from '../src/index.ts';
import { bundle, ref, patch, fresh } from './infirmary_fixture.ts';
const qkey = 'ashmere_missing_child@0.0.20:quest/infirmary_herbs';
const roomkey = 'ashmere_missing_child@0.0.20:room/willow_shade';
const quest = bundle.value.quests[qkey];
const detail = bundle.value.rooms[roomkey].details.fenwort_patch;

// Breaks: missing stock/fact/participant or malformed bounded quantities cross the typed boundary.
test('harvest, exchange and retirement retain required identities and bounded stock', () => {
  const harvest = { type: 'harvest', actor_id: fresh.character, target_id: patch };
  const retire = {
    op: 'quest.retire',
    writer_group: 0,
    instance_id: 'aaaaaaaa-1111-4222-8333-444444444444',
    quest: ref('quest', 'infirmary_herbs'),
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

// Breaks: a forged family, reward holder, overlap, contribution bound or obsolete API loads despite invalid funding.
test('loader independently rejects invalid authored exchange and harvest stock', () => {
  const cases = [
    (c: any) => {
      c.quests[qkey].exchange.outgoing[1] = c.quests[qkey].exchange.outgoing[0];
    },
    (c: any) => {
      c.quests[qkey].exchange.incoming[0] = c.quests[qkey].exchange.outgoing[0];
    },
    (c: any) => {
      c.items['ashmere_missing_child@0.0.20:item/bandage_01'].location = {
        in: 'room',
        room: ref('room', 'infirmary'),
      };
    },
    (c: any) => {
      c.items['ashmere_missing_child@0.0.20:item/fenwort_01'].mass_grams = 0;
    },
    (c: any) => {
      c.quests[qkey].exchange.quantity = 13;
    },
    (c: any) => {
      c.quests[qkey].exchange.increment = 4;
    },
    (c: any) => {
      delete c.facts['ashmere_missing_child@0.0.20:fact/infirmary_contribution'];
    },
    (c: any) => {
      delete c.rooms[roomkey].details.fenwort_patch;
    },
    (c: any) => {
      c.manifest.requires.kernel_api.at_least = '1.16';
    },
  ];
  for (const change of cases) {
    const c = structuredClone(bundle.value);
    change(c);
    const bytes = encode(c);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const loaded = loadCartridge(
      new TextEncoder().encode(JSON.stringify({ cartridge: c, content_hash: hash })),
      INSTALLED,
    );
    assert.equal(loaded.ok, false);
  }
});
