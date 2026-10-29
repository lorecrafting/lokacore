import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadCartridge, INSTALLED } from '../src/index.ts';
import { bundle, prefix, ref } from './dream_fixture.ts';
const load = (change: (c: any) => void = () => {}) => {
  const b = bundle(change);
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
    INSTALLED,
  );
};
// Breaks: a source-valid graph binds a nonexistent/unpaid bed, unsafe credit/memory or foreign quest, or permits another producer for its sole consequence.
test('loader refuses impossible Rest, graph and exclusive end bindings', () => {
  assert.equal(load().ok, true);
  const scene = (c: any) => c.scenes[`${prefix}:scene/fen_dream`];
  for (const [name, change] of [
    [
      'missing dependency',
      (c: any) => {
        delete c.lock.capabilities.death;
        delete c.manifest.requires.capabilities.death;
      },
    ],
    ['wrong room', (c: any) => (scene(c).on.rest.room = ref('room', 'village_green'))],
    ['missing detail', (c: any) => (scene(c).on.rest.detail = 'other')],
    ['foreign entitlement', (c: any) => (scene(c).on.rest.entitlement = ref('fact', 'dream_seen'))],
    ['instance credit', (c: any) => (c.facts[`${prefix}:fact/slept_paid`].scopes = ['instance'])],
    [
      'default credit',
      (c: any) => (c.facts[`${prefix}:fact/slept_paid`].value_type.default = true),
    ],
    ['different graph', (c: any) => (scene(c).steps[0] = { type: 'branch' })],
    ['repeated choice', (c: any) => (scene(c).steps[3].choices[1].choice_id = 'follow_fox')],
    ['missing branch prose', (c: any) => (scene(c).steps[3].choices[1].text = 'missing.line')],
    ['wrong final quest', (c: any) => (scene(c).on_end.quest = ref('quest', 'lantern'))],
    [
      'early objective',
      (c: any) =>
        (c.quests[`${prefix}:quest/a_room`].objective.policy.root.fact = ref('fact', 'slept_paid')),
    ],
    ['false memory', (c: any) => (scene(c).on_end.assign[0].value = false)],
    [
      'credit equals memory',
      (c: any) => (scene(c).on_end.assign[0].fact = ref('fact', 'slept_paid')),
    ],
    [
      'inherited quest producer',
      (c: any) =>
        (c.dialogues[`${prefix}:dialogue/bram`].choices.carry.accept = ref('quest', 'a_room')),
    ],
  ] as const)
    assert.match(JSON.stringify(load(change)), /"ok":false.*(fen_dream|dialogue\/bram)/, name);
});
