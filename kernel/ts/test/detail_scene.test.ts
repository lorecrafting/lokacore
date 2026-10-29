// A scene started by a detail scripted action and ended by an acknowledged story point (scene@1, kernel 1.15),
// over the scene_sampler KAT with one inline Begin scripted action, scene and story point.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step, type World } from '../src/index.ts';
import type { Command } from '../src/contracts.gen.ts';
import { value } from '../src/mechanics/fact.ts';
import { fragment } from './fragment.ts';

const f = fragment('protocol/fixtures/cartridge_scene_hash.json');
const { prefix, ref } = f;
const SCENE = `${prefix}:scene/begin`;
// The compiler's scene@1 FactSpecs, byte for byte (the loader refuses any other).
const fact = (key: string, value_type: object, meaning: string) => ({
  key,
  version: 1,
  value_type,
  scopes: ['player'],
  meaning,
});
const begin = (c: any) => {
  const room = ref('room', 'ferry_landing');
  c.manifest.requires.kernel_api.at_least = '1.15';
  const details = c.rooms[`${prefix}:room/ferry_landing`].details;
  details.notice = { aliases: ['notice'], description: 'detail.mooring_post' };
  c.scripted_actions[`${prefix}:action/begin`] = {
    key: 'begin',
    name: 'actions.coil_rope',
    aliases: ['begin'],
    target: { kind: 'detail', room, detail: 'mooring_post' },
    priority: 10,
    policy: { op: 'all', items: [] },
    outcomes: {
      success: {
        sequence: [{ op: 'event.emit', event: 'begun' }],
        narration: { actor: 'narration.coil_rope.actor' },
      },
    },
  };
  c.scenes[SCENE] = {
    key: 'begin',
    on: {
      action: ref('scripted_action', 'begin'),
      room,
      detail: 'mooring_post',
      outcome: 'success',
    },
    control: 'modal',
    steps: [
      { type: 'narrate', text: 'scene.bell_rung.bell' },
      { type: 'narrate', text: 'scene.bell_rung.fen' },
      { type: 'await_ack' },
      { type: 'end' },
    ],
    on_end: {
      assign: [{ fact: ref('fact', 'search_plan'), value: 'party_led' }],
      story_point: ref('story_point', 'begun'),
      outcome: 'done',
    },
  };
  c.facts[`${prefix}:fact/scene_begin`] = fact(
    'scene_begin',
    {
      type: 'int',
      minimum: -1,
      maximum: 2,
      default: 0,
    },
    "Scene begin's line (scene@1): 0 not started, 1..n shown, -1 ended; only scene@1 writes it.",
  );
  c.facts[`${prefix}:fact/story_point_begun`] = fact(
    'story_point_begun',
    {
      type: 'enum',
      values: ['unreached', 'done'],
      default: 'unreached',
    },
    "Story point begun's reached outcome (scene@1): only scene@1 writes it.",
  );
  c.story_points[`${prefix}:story_point/begun`] = {
    key: 'begun',
    outcomes: { done: { scene: ref('scene', 'begin') } },
  };
};

// Breaks: Begin starts on arrival, or the story point and its assign are
// written before the final shown line is acknowledged, or more than once.
test('Begin starts its scene only by choice and reports once at the final acknowledgement', () => {
  let world: World = f.genesis(begin);
  let n = 0;
  const run = (payload: object, expected = 'accepted') => {
    const command = {
      id: `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      world_context_id: world.context,
      payload: { actor_id: world.character, ...payload },
    } as Command;
    const result = step(world, command, n);
    const d = result.decision;
    assert.equal(d.kind === 'rejected' ? d.error.code : d.kind, expected, JSON.stringify(d));
    world = result.world;
    return d;
  };
  const shown = () => {
    const s = gameView(world).scene!;
    return run({ type: 'continue', scene: s.scene, line: s.index });
  };
  const flags = () =>
    ['search_plan', 'story_point_begun'].map((k) => value(world, world.character, ref('fact', k)));
  const detail = (key: string) =>
    Object.keys(world.details).find((id) => world.details[id].key === key);
  assert.equal(gameView(world).scene, undefined);
  run({ type: 'perform', action: 'begin', target_id: detail('mooring_post') });
  assert.equal(gameView(world).scene?.index, 1);
  shown();
  assert.equal(gameView(world).scene?.index, 2);
  assert.deepEqual(flags(), ['undecided', 'unreached']);
  const done = shown();
  assert.equal(gameView(world).scene, undefined);
  assert.deepEqual(flags(), ['party_led', 'done']);
  assert.equal(done.kind, 'accepted');
  if (done.kind === 'accepted')
    assert.equal(done.events.filter((e) => e.payload.type === 'story_point_reached').length, 1);
});
