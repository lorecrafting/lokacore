// Inspectable details and target resolution (R5 S2; 21 §6-§7; 04 §17-§18). The world is built
// from the details known answer (protocol/fixtures/cartridge_details_hash.json). Expected ids
// are Python's hashlib over the IdSource input ["loka-id-v1", context, nil command id, ordinal]
// (numeric profile, Initial world ids): rooms at 2-4, then details in room and key order.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Command } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { check } from '../src/invariants.ts';
import { resolve } from '../src/target.ts';
import { INSTALLED, newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

const kat = read('protocol/fixtures/cartridge_details_hash.json');
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const CHARACTER = 'bd595711-ea5f-89a5-abb0-046cd349d2f9'; // ordinal 0
const FERRY = '91fde0fc-dd14-846f-826e-245e45d16ec7'; // 3
const WELL_LANE = '953a909b-3a29-8c5c-9e3f-4105b9a47c4b'; // 4
const MOORING = 'ff864ad5-cd56-80c8-9392-dc88bdc28fd2'; // 5: ferry_landing mooring_post
const NOTICE = '6a70d262-b6ea-8b64-9809-ec7f79d1521e'; // 6: notice
const TIDE = '0f5f2329-bcff-82f4-948a-3d22a75fb068'; // 7: tide_marks
const BUCKET = 'd530207e-b845-8be5-9d53-b44b2cf5d8a1'; // 8: well_lane bucket
const STEPS = '2ef35eee-f837-8b28-bea7-9748a332940a'; // 9: steps
const WELL = '470b4175-5b92-89c1-bdac-645a128dc72f'; // 10: well

const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok);
const fresh = () =>
  newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], [1, 0, 0, 0]);
const cmd = (payload: object): Command =>
  ({
    id: 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b',
    world_context_id: CONTEXT,
    payload: { actor_id: CHARACTER, ...payload },
  }) as Command;
const north = (w: World) => step(w, cmd({ type: 'move', direction: 'north' })).world;

// Breaks: detail ids minted in another order (such as the object's key order) or from other
// ordinals, or tied to the wrong room.
test('a fresh world gives each detail a target id after the rooms', () => {
  const w = fresh();
  const shuffled = structuredClone(loaded.cartridge) as any;
  const room = shuffled.rooms['ashmere_details@0.0.1:room/ferry_landing'];
  room.details = Object.fromEntries(Object.entries(room.details).reverse());
  const again = newWorld(shuffled, CONTEXT as World['context'], [1, 0, 0, 0]);
  assert.deepEqual(again.details, w.details);
  const by = Object.entries(w.details).map(([id, d]) => [id, d.room, d.key]);
  assert.deepEqual(by.sort(), [
    [TIDE, FERRY, 'tide_marks'],
    [STEPS, WELL_LANE, 'steps'],
    [WELL, WELL_LANE, 'well'],
    [NOTICE, FERRY, 'notice'],
    [BUCKET, WELL_LANE, 'bucket'],
    [MOORING, FERRY, 'mooring_post'],
  ]);
});

// Breaks: a prefix or substring treated as a match, another room's details in scope, the
// normalization rule changed, or ambiguous candidates unsorted.
test('resolution is none, unique or ambiguous per the hand-written table', () => {
  const ferry = fresh();
  const lane = north(ferry);
  const rows: [World, string, object][] = [
    [ferry, 'mooring post', { kind: 'unique', target_id: MOORING }],
    [ferry, 'at the  Mooring Post', { kind: 'unique', target_id: MOORING }],
    [ferry, 'marks', { kind: 'unique', target_id: TIDE }],
    [ferry, 'post', { kind: 'ambiguous', candidate_ids: [NOTICE, MOORING] }],
    [ferry, 'the post', { kind: 'ambiguous', candidate_ids: [NOTICE, MOORING] }],
    [ferry, 'moor', { kind: 'none' }],
    [ferry, 'mooring post fox', { kind: 'none' }],
    [ferry, 'bucket', { kind: 'none' }],
    [ferry, 'the', { kind: 'none' }],
    [lane, 'well bucket', { kind: 'unique', target_id: BUCKET }],
    [lane, 'a well', { kind: 'unique', target_id: WELL }],
    [lane, 'post', { kind: 'none' }],
  ];
  for (const [w, text, expected] of rows) {
    const resolution = resolve(w, w.character, text);
    assert.deepEqual(resolution, expected, text);
    assert.ok(check('target_candidates_ordered', { resolution }), text);
  }
});

// Breaks: look ignores its target, or a stale or foreign target_id is admitted.
test('look with a target_id examines a detail of this room, else not_found or not_present', () => {
  const w = fresh();
  const look = (target_id: string) => step(w, cmd({ type: 'look', target_id })).decision;
  assert.equal((look(MOORING) as { outcome?: string }).outcome, 'examined');
  assert.deepEqual(look(BUCKET), { kind: 'rejected', error: { code: 'not_present' } });
  assert.deepEqual(look(FERRY), { kind: 'rejected', error: { code: 'not_found' } });
  assert.equal((step(w, cmd({ type: 'look' })).decision as { outcome?: string }).outcome, 'looked');
});
