// Riddle fragment: the frozen scene_sampler KAT (Bram, the lantern quest, the coil_rope recipe at
// Ferry Landing) plus an inline bounded riddle: a sphinx beside Bram asks a riddle of the lantern
// quest that binds both of them, and coiling the rope starts a modal scene.
import assert from 'node:assert/strict';
import { gameView, step, type World } from '../src/index.ts';
import { fragment } from './fragment.ts';

const f = fragment('protocol/fixtures/cartridge_scene_hash.json');
export const { ref, prefix } = f;
export const entity = (w: World, kind: string, name: string) =>
  w.entityIds[`${prefix}:${kind}/${name}`]!;

const active = {
  policy_version: 1,
  root: { op: 'quest_state', quest: ref('quest', 'lantern'), state: 'active' },
};

export function riddleSource(c: any) {
  c.manifest.requires.kernel_api.at_least = '1.21';
  c.npcs[`${prefix}:npc/sphinx`] = {
    key: 'sphinx',
    keywords: ['sphinx'],
    short: 'npc.sphinx.short',
    description: 'npc.sphinx.description',
    room_line: 'npc.sphinx.room',
    room: ref('room', 'ferry_landing'),
  };
  c.facts[`${prefix}:fact/riddle_solved`] = {
    key: 'riddle_solved',
    version: 1,
    value_type: { type: 'bool', default: false },
    scopes: ['player'],
    meaning: 'The sphinx riddle was answered.',
  };
  c.dialogues[`${prefix}:dialogue/riddle`] = {
    key: 'riddle',
    npc: ref('npc', 'sphinx'),
    prompt: 'dialogue.riddle.prompt',
    quest: ref('quest', 'lantern'),
    policy: active,
    roles: {
      sphinx: { role: 'npc', npc: ref('npc', 'sphinx') },
      bram: { role: 'npc', npc: ref('npc', 'bram') },
    },
    choices: {
      answer: {
        label: 'dialogue.riddle.answer',
        narration: 'narration.riddle.answer',
        sequence: [{ op: 'fact.assign', fact: ref('fact', 'riddle_solved'), value: true }],
      },
    },
    riddle: {
      choice_id: 'answer',
      answer: 'tide',
      bank: ['T', 'I', 'D', 'E'],
      wrong: 'narration.riddle.wrong',
      wrong_limit: 3,
    },
  };
  c.facts[`${prefix}:fact/scene_rope_coiled`] = {
    key: 'scene_rope_coiled',
    version: 1,
    value_type: { type: 'int', default: 0, minimum: -1, maximum: 1 },
    scopes: ['player'],
    meaning:
      "Scene rope_coiled's line (scene@1): 0 not started, 1..n shown, -1 ended; only scene@1 writes it.",
  };
  c.scenes[`${prefix}:scene/rope_coiled`] = {
    key: 'rope_coiled',
    control: 'modal',
    on: {
      action: ref('recipe', 'coil_rope'),
      room: ref('room', 'ferry_landing'),
      detail: 'mooring_post',
      outcome: 'success',
    },
    steps: [
      { type: 'narrate', text: 'scene.rope_coiled.line' },
      { type: 'await_ack' },
      { type: 'end' },
    ],
  };
  Object.assign(c.text, {
    'npc.sphinx.short': 'a sphinx',
    'npc.sphinx.description': 'A sphinx.',
    'npc.sphinx.room': 'A sphinx is here.',
    'dialogue.riddle.prompt': 'What comes in twice a day?',
    'dialogue.riddle.answer': 'Answer',
    'narration.riddle.answer': 'The sphinx nods.',
    'narration.riddle.wrong': 'The sphinx shakes its head.',
    'scene.rope_coiled.line': 'The rope lies coiled.',
  });
}
const withRiddle =
  (change: (c: any) => void = () => {}) =>
  (c: any) => {
    riddleSource(c);
    change(c);
  };
export const bundle = (change?: (c: any) => void) => f.bundle(withRiddle(change));
export const genesis = (change?: (c: any) => void) => f.genesis(withRiddle(change));

/** Kernel steps over a riddle world: `run` asserts the decision kind or refusal code. */
export function runner(initial: World = genesis()) {
  let world = initial,
    n = 0;
  const run = (payload: object, expected = 'accepted') => {
    const r = step(
      world,
      {
        id: `bbbbbbbb-0000-4000-8000-${String(++n).padStart(12, '0')}`,
        world_context_id: world.context,
        payload: { actor_id: world.character, ...payload },
      } as never,
      n,
    );
    const kind = r.decision.kind === 'rejected' ? r.decision.error.code : r.decision.kind;
    assert.equal(kind, expected, JSON.stringify(r.decision));
    world = r.world;
    return r.decision;
  };
  const view = () => gameView(world);
  const talk = (name: string) => run({ type: 'talk', target_id: entity(world, 'npc', name) });
  const choose = (choice_id: string, answer?: string, expected?: string) =>
    run(
      {
        type: 'choose',
        continuation_id: view().choice!.continuation_id,
        choice_id,
        ...(answer !== undefined && { answer }),
      },
      expected,
    );
  /** Accept the lantern quest and open the riddle. */
  const start = () => {
    run({ type: 'accept_quest', quest: ref('quest', 'lantern') });
    talk('sphinx');
  };
  return {
    run,
    view,
    talk,
    choose,
    start,
    world: () => world,
    set: (w: World) => {
      world = w;
    },
  };
}
