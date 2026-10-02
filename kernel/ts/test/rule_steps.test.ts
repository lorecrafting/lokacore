// The query_steps a rule's own policy reads add to its admission's (04 §5.4; R6P B): barrier@1's
// key check (one has_item leaf), quest@1's current_state objective at activation (the ferry's:
// one has_item leaf) and dialogue@1's talk policy, read twice (once at admission as the offered
// talk's policy, once by the talk rule; PM default). Worlds are the gate and ferry known answers
// (protocol/fixtures/cartridge_{gate,ferry}_hash.json, 06:00) with one policy replaced by `all` of
// n true time_window leaves, re-hashed with node:crypto. Expected values are hand-counted.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Command } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { encode } from '../src/canonical.ts';
import { INSTALLED, newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

const all = (n: number) => ({
  policy_version: 1,
  root: { op: 'all', items: Array(n).fill({ op: 'time_window', from: 0, to: 12 }) },
});
const world = (name: string, edit: (c: any) => void): World => {
  const c = structuredClone(read(`protocol/fixtures/cartridge_${name}_hash.json`).value);
  edit(c);
  const text = encode(c);
  const h = createHash('sha256').update(text).digest('hex');
  const bytes = new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`);
  const loaded = loadCartridge(bytes, INSTALLED);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as World['context'];
  return newWorld(loaded.cartridge as Cartridge, context, [1, 2, 3, 4]);
};
// `payload` stepped as command `k` at revision `k`.
const stepped = (w: World, payload: object, k = 1) => {
  const id = `e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9${k}`;
  const c = { id, world_context_id: w.context, payload: { actor_id: w.character, ...payload } };
  return step(w, c as Command, k);
};
// What `payload` gets: accepted, or the limit of its budget fault.
const outcome = (w: World, payload: object, k = 1) => {
  const s = stepped(w, payload, k);
  return s.limit ?? s.decision.kind;
};

// Breaks: barrier@1's key check not counted (world.ts not passing the counter to the rule, or
// barrier.ts not passing it to holds). The iron key is in the body; unlock overridden by an
// action of n leaves: n + 1 steps.
test('an unlock counts its key check: 32767 action leaves fit, 32768 exceed query_steps', () => {
  const unlock = (n: number) => {
    const w = world('gate', (c) => {
      c.actions['ashmere_gate@0.0.1:action/unlock'] = {
        key: 'unlock',
        label: 'room.cell.title', // any key of the catalog
        accessibility: 'room.cell.title',
        target: { kind: 'none' },
        command: 'unlock',
        priority: 0,
        input: ['direction'],
        policy: all(n),
      };
    });
    const key = w.entityIds['ashmere_gate@0.0.1:item/iron_key']!;
    const containers = { ...w.state.containers, [key]: w.body };
    return outcome(
      { ...w, state: { ...w.state, containers } },
      { type: 'unlock', direction: 'east' },
    );
  };
  assert.equal(unlock(32767), 'accepted');
  assert.equal(unlock(32768), 'query_steps');
});

// Breaks: quest@1's objective read at activation not counted (quest.ts holdsNow). The offer's
// policy has n leaves: n + 1 steps.
test('an accept counts its objective check: 32767 offer leaves fit, 32768 exceed query_steps', () => {
  const accept = (n: number) => {
    const w = world(
      'ferry',
      (c) => (c.quests['ashmere_ferry@0.0.1:quest/lantern'].offer.policy = all(n)),
    );
    const quest = {
      cartridge_id: 'ashmere_ferry',
      cartridge_version: '0.0.1',
      kind: 'quest',
      key: 'lantern',
    };
    return outcome(w, { type: 'accept_quest', quest });
  };
  assert.equal(accept(32767), 'accepted');
  assert.equal(accept(32768), 'query_steps');
});

// Breaks: the talk rule's policy read not counted (dialogue.ts talkRefused), or counted once.
// Bram's dialogue policy has n leaves: 2n steps.
test('a talk counts its policy twice: 16384 leaves fit, 16385 exceed query_steps', () => {
  const talk = (n: number) => {
    const w = world(
      'ferry',
      (c) => (c.dialogues['ashmere_ferry@0.0.1:dialogue/bram'].policy = all(n)),
    );
    return outcome(w, { type: 'talk', target_id: w.entityIds['ashmere_ferry@0.0.1:npc/bram'] });
  };
  assert.equal(talk(16384), 'accepted');
  assert.equal(talk(16385), 'query_steps');
});

// Breaks: the choose rule's objective read not counted (dialogue.ts choose not passing the
// counter to quest.ts resolution). Accepted with the lantern, taken, Bram talked to; the
// objective is `all` of has_item lantern (false at accept, so 1 step there) then n leaves: n + 1.
test('a choose counts its objective check: 32767 leaves fit, 32768 exceed query_steps', () => {
  const chosen = (n: number) => {
    const F = 'ashmere_ferry@0.0.1';
    let w = world('ferry', (c) => {
      const has = c.quests[`${F}:quest/lantern`].objective.policy.root;
      c.quests[`${F}:quest/lantern`].objective.policy = { ...all(n) };
      c.quests[`${F}:quest/lantern`].objective.policy.root.items.unshift(has);
    });
    const quest = {
      cartridge_id: 'ashmere_ferry',
      cartridge_version: '0.0.1',
      kind: 'quest',
      key: 'lantern',
    };
    const lantern = w.entityIds[`${F}:item/lantern`];
    const bram = w.entityIds[`${F}:npc/bram`];
    const steps = [
      { type: 'accept_quest', quest },
      { type: 'take', item_id: lantern },
      { type: 'talk', target_id: bram },
    ];
    for (const [i, p] of steps.entries()) {
      const s = stepped(w, p, i + 1);
      assert.equal(s.decision.kind, 'accepted', JSON.stringify(s.decision));
      w = s.world;
    }
    const continuation_id = Object.keys(w.state.choices!)[0];
    return outcome(w, { type: 'choose', choice_id: 'carry', continuation_id }, 4);
  };
  assert.equal(chosen(32767), 'accepted');
  assert.equal(chosen(32768), 'query_steps');
});
