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
  const scene = (c: any) => c.scenes[`${prefix}:scene/dream_of_the_fen`];
  for (const [name, change] of [
    ['old API', (c: any) => (c.manifest.requires.kernel_api.at_least = '1.24')],
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
    [
      'instance credit',
      (c: any) => (c.facts[`${prefix}:fact/slept_at_lantern`].scopes = ['instance']),
    ],
    [
      'default credit',
      (c: any) => (c.facts[`${prefix}:fact/slept_at_lantern`].value_type.default = true),
    ],
    ['different graph', (c: any) => (scene(c).steps[0] = { type: 'branch' })],
    ['repeated choice', (c: any) => (scene(c).steps[3].choices[1].choice_id = 'follow_fox')],
    ['missing branch prose', (c: any) => (scene(c).steps[3].choices[1].text = 'missing.line')],
    ['wrong final quest', (c: any) => (scene(c).on_end.quest = ref('quest', 'missing_child'))],
    [
      'early objective',
      (c: any) =>
        (c.quests[`${prefix}:quest/a_room_at_the_lantern`].objective.policy.root.fact = ref(
          'fact',
          'slept_at_lantern',
        )),
    ],
    ['false memory', (c: any) => (scene(c).on_end.assign[0].value = false)],
    [
      'credit equals memory',
      (c: any) => (scene(c).on_end.assign[0].fact = ref('fact', 'slept_at_lantern')),
    ],
    [
      'foreign memory writer',
      (c: any) =>
        (c.dialogues[`${prefix}:dialogue/maud_offer`].choices.accept.sequence = [
          { op: 'fact.assign', fact: ref('fact', 'dream_seen'), value: true },
        ]),
    ],
    [
      'inherited quest producer',
      (c: any) =>
        (c.dialogues[`${prefix}:dialogue/maud_offer`].choices.accept.accept = ref(
          'quest',
          'a_room_at_the_lantern',
        )),
    ],
  ] as const)
    assert.equal(load(change).ok, false, name);
});
