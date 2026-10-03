// The pre-release proof cartridge The Ferryman's Lantern (pre-release-proof.md, Concrete proof;
// R6P P3): its known answer (protocol/fixtures/cartridge_lantern_hash.json, Python) loads on the
// installed kernel, and both endings play as the frozen traces say
// (docs/spec/conformance/lantern-traces.json: lantern-carry, lantern-leave). Ids come from the
// GameView, as a player reads them; codes are the traces' under the brief's projection (choose's
// resolved_carry is outcome carry, story point proof.terminal is Key proof_terminal). The quest is
// accepted as Bram's offer dialogue choice (docs/system/mechanics.md dialogue@1).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Command, EntityId } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { gameView, INSTALLED, newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

const kat = read('protocol/fixtures/cartridge_lantern_hash.json');
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const load = () =>
  loadCartridge(
    new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
    INSTALLED,
  );

// Breaks: a capability the content uses missing from INSTALLED or the lock, the artifact's hash
// read from anything but its bytes, or the fixture's canonical bytes drifting from its hand-written
// value (the lock included).
test('the known answer loads with its hash, as its hand-written value', () => {
  const loaded = load();
  assert.ok(loaded.ok, JSON.stringify(loaded));
  assert.equal(loaded.hash, '806508c7d82223575e74873b7e60ffd61705e675cf0989d0f864e916de6b9e84');
  assert.deepEqual(structuredClone(loaded.cartridge), kat.value);
});

const world = (): World => {
  const loaded = load();
  assert.ok(loaded.ok);
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], [1, 2, 3, 4]);
};
let n = 0;
// Steps `payload` under a fresh CommandId.
const run = (w: World, payload: object) => {
  const id = `e5f6a7b8-c9d0-8e1f-8a2b-${String(++n).padStart(12, '0')}`;
  const command = { id, world_context_id: CONTEXT, payload: { actor_id: w.character, ...payload } };
  return step(w, command as Command, n);
};
// Steps `payload`; asserts it accepted with `outcome`.
const play = (w: World, payload: object, outcome: string) => {
  const s = run(w, payload);
  assert.equal(
    s.decision.kind === 'accepted' && s.decision.outcome,
    outcome,
    JSON.stringify(payload),
  );
  return s;
};
const here = (w: World, kind: string) => gameView(w).entities.find((e) => e.kind === kind)?.id;
const move = (w: World, ...dirs: string[]) =>
  dirs.reduce((v, direction) => play(v, { type: 'move', direction }, 'moved').world, w);

for (const [choice_id, plan] of [
  ['carry', 'player_led'],
  ['leave', 'party_led'],
] as const)
  // Breaks: a place action still offering the quest, a wrong landing variant, or Bram's talk still
  // offered after the ending (the frozen traces pin the rest).
  test(`the ${choice_id} ending lands in its variant and ends Bram's talk`, () => {
    let w = world();
    assert.ok(!gameView(w).actions.some((a) => a.action_key === 'lantern')); // no place action
    w = play(w, { type: 'talk', target_id: here(w, 'npc') }, 'choice_opened').world;
    const offer = gameView(w).choice!.continuation_id;
    w = play(w, { type: 'choose', choice_id: 'accept', continuation_id: offer }, 'accept').world;
    w = move(w, 'north', 'east', 'east');
    w = play(w, { type: 'take', item_id: here(w, 'item') as EntityId }, 'taken').world;
    w = move(w, 'west', 'west', 'south');
    const bram = here(w, 'npc') as EntityId;
    w = play(w, { type: 'talk', target_id: bram }, 'choice_opened').world;
    const continuation_id = gameView(w).choice!.continuation_id;
    w = play(w, { type: 'choose', choice_id, continuation_id }, choice_id).world;
    assert.equal(gameView(w).place.description.key, `room.landing.${plan}`);
    assert.deepEqual(
      gameView(w)
        .entities.find((e) => e.id === bram)!
        .actions.map((a) => [a.action_key, a.available]),
      [
        ['bram', false],
        ['bram_offer', false],
      ],
    );
  });

// Breaks: the gate unlocked or missing, or the start time wrong.
test('at 06:00 the west gate is locked', () => {
  const w = world();
  assert.equal(w.state.clock, 6 * 3600);
  assert.deepEqual(
    gameView(w).exits.find((e) => e.direction === 'west'),
    { available: false, direction: 'west', reason: { code: 'exit_locked' } },
  );
  assert.deepEqual(run(w, { type: 'unlock', direction: 'west' }).decision, {
    kind: 'rejected',
    error: { code: 'not_owned' },
  });
});
