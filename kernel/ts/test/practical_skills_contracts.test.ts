import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { encode } from '../src/foundation/canonical.ts';
import { loadCartridge, INSTALLED } from '../src/index.ts';
import { validate } from '../src/foundation/validate.ts';
import { practicalBundle, ref } from './practical_skills_fixture.ts';
const source = practicalBundle().value;
const load = (c: any) =>
  loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({
        cartridge: c,
        content_hash: createHash('sha256').update(encode(c)).digest('hex'),
      }),
    ),
    INSTALLED,
  );
const patch = (c: any) =>
  c.rooms['ashmere_missing_child@0.0.30:room/willow_shade'].details.fenwort_patch;
const shop = (c: any) => c.npcs['ashmere_missing_child@0.0.30:npc/peg'].shop;
// Breaks: malformed careful method, optional metadata, or unsafe tuning crosses closed wire/content validation.
test('method is literal and optional declarations enforce every new field and numeric boundary', () => {
  const payload = {
    type: 'harvest',
    actor_id: 'bd595711-ea5f-89a5-abb0-046cd349d2f9',
    target_id: 'f3f1415f-eac6-8111-ac50-7a42d21fb011',
  };
  assert.deepEqual(validate('CommandPayload', { ...payload, method: 'careful' }), []);
  assert.deepEqual(validate('CommandPayload', payload), []);
  assert.ok(validate('CommandPayload', { ...payload, method: 'quick' }).length);
  assert.ok(validate('ActionInput', { method: 'quick' }).length);
  assert.deepEqual(validate('ActionInput', { method: 'careful' }), []);
  for (const field of ['skill', 'count', 'action', 'narration']) {
    const c = structuredClone(source);
    delete patch(c).harvest.careful[field];
    assert.ok(validate('InspectableDetail', patch(c)).length, field);
    assert.equal(load(c).ok, false, field);
  }
  for (const field of ['skill', 'numerator', 'denominator', 'minimum']) {
    const c = structuredClone(source);
    delete shop(c).buy_discount[field];
    assert.ok(validate('Shop', shop(c)).length, field);
    assert.equal(load(c).ok, false, field);
  }
  const mutants = [
    (c: any) => (patch(c).harvest.careful.count = 1),
    (c: any) => (patch(c).harvest.careful.count = 65),
    (c: any) => (patch(c).harvest.careful.count = 13),
    (c: any) => (patch(c).harvest.careful.skill = ref('skill', 'absent')),
    (c: any) => (patch(c).harvest.careful.narration = 'absent'),
    (c: any) => (patch(c).harvest.careful.action = 'harvest'),
    (c: any) => (patch(c).harvest.careful.extra = true),
    (c: any) => delete c.manifest.requires.capabilities.skills,
    (c: any) => (shop(c).buy_discount.skill = ref('skill', 'absent')),
    (c: any) => (shop(c).buy_discount.extra = true),
    (c: any) => (shop(c).buy_discount.numerator = 11),
    (c: any) => (shop(c).buy_discount.minimum = 3),
    (c: any) => {
      shop(c).offers[0].buy = 2147483647;
      shop(c).buy_discount.numerator = shop(c).buy_discount.denominator = 2147483647;
    },
  ];
  for (const field of ['numerator', 'denominator', 'minimum'])
    for (const n of [0, 2147483648]) {
      const c = structuredClone(source);
      shop(c).buy_discount[field] = n;
      assert.ok(validate('Shop', shop(c)).length, `${field}/${n}`);
      mutants.push((c: any) => (shop(c).buy_discount[field] = n));
    }
  for (const count of [1, 65]) {
    const c = structuredClone(source);
    patch(c).harvest.careful.count = count;
    assert.ok(validate('InspectableDetail', patch(c)).length, `count/${count}`);
  }
  for (const change of mutants) {
    const c = structuredClone(source);
    change(c);
    assert.equal(load(c).ok, false);
  }
  assert.equal(load(source).ok, true);
});
