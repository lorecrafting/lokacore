// Step admission keeps the invoked action (04 §19, ACT-09; R6P P5a, the T carry): given the
// invocation's action_key, admission matches that action only, not any action that resolves to the
// same Command. Worlds are T's probe world (ferry_probe.ts) with a `chat` talk alias and the quest
// active. Expected codes are literals from 04 §19 and the GameView rows.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EntityId } from '../src/contracts.gen.ts';
import type { World } from '../src/index.ts';
import { resolve } from '../src/invocation.ts';
import { attempt } from '../src/known_answers.ts';
import { step } from '../src/world.ts';
import { accept, after, at, chat, CID, F, PRESENT, shown, world } from './ferry_probe.ts';

// `action_key` invoked on `target`: resolved, then stepped with the key, as the local authority.
const keyed = (w: World, action_key: string, target: EntityId) => {
  const invocation = { action_key, actor_id: w.character, target_ids: [target], input: {} };
  const c = resolve(w, { invocation, command_id: CID } as never);
  assert.ok('payload' in c, JSON.stringify(c));
  const d = step(w, c, 9, action_key as never).decision;
  return d.kind === 'accepted' ? d.kind : 'error' in d ? d.error.code : d.kind;
};

// Breaks: admission matching any action of the set that resolves to the Command (bram on ada
// passes through chat to the rule's not_found; a failing chat on Bram passes through bram), or
// the key filter refusing the invoked action itself.
test('admission decides the invoked action only', () => {
  const active = after(
    world((c) => (c.actions[`${F}:action/chat`] = chat(PRESENT))),
    accept,
  );
  const failing = after(
    world((c) => (c.actions[`${F}:action/chat`] = chat({ op: 'not', item: PRESENT }))),
    accept,
  );
  const [ada, bram] = [at(active, 'npc/ada'), at(active, 'npc/bram')];
  assert.deepEqual(
    [
      keyed(active, 'bram', ada),
      shown(failing, 'chat', bram),
      keyed(failing, 'chat', bram),
      keyed(failing, 'bram', bram),
    ],
    ['unsupported_capability', 'invalid_state', 'invalid_state', 'accepted'],
  );
});

// Breaks: the known-answer runner (Node and Hermes) stepping without the key, so it pins bram on
// ada as not_found (via chat) while the local authority answers unsupported_capability.
test('the known-answer runner steps with the invoked action', () => {
  const w = after(
    world((c) => (c.actions[`${F}:action/chat`] = chat(PRESENT))),
    accept,
  );
  const invocation = {
    invocation_id: 'f6a7b8c9-d0e1-4f2a-8b3c-5d6e7f8a9b0c',
    action_key: 'bram',
    actor_id: w.character,
    target_ids: [at(w, 'npc/ada')],
    input: {},
  };
  const { result } = attempt(w, 'story/probe', invocation, 9);
  assert.deepEqual((result as { decision: object }).decision, {
    kind: 'rejected',
    code: 'unsupported_capability',
  });
});
