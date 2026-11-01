// dev@1 (docs/system/cartridge.md#author-preview): the cheats' decisions, with literal refusals.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INSTALLED, newWorld, step, stepDev } from '../src/runtime/world.ts';
import { loadCartridge } from '../src/index.ts';
import { bodyOf, refString, type Cartridge, type World } from '../src/runtime/decision.ts';
import type { Command, DefinitionRef } from '../src/contracts.gen.ts';
import { decideReplay, start } from '../play/run.ts';
import { resolveDev } from '../src/commands/invocation.ts';
import { fragment } from './fragment.ts';
import { read } from './read.ts';

const kat = read('protocol/fixtures/toolbox_showcase_hash.json');
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok);
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const fresh = () =>
  newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], [1, 2, 3, 4]);
const ref = (kind: string, key: string) => ({
  cartridge_id: 'toolbox_showcase',
  cartridge_version: '0.0.1',
  kind,
  key,
});
const cmd = (w: World, payload: object) =>
  ({
    id: 'e5f6a7b8-c9d0-4e1f-8a2b-4c5d6e7f8a9b',
    world_context_id: w.context,
    payload: { actor_id: w.character, ...payload },
  }) as Command;
const go = (w: World, key = 'boar_run') =>
  stepDev(w, cmd(w, { type: 'dev_go_to_room', room: ref('room', key) }), 1);
const set = (w: World, key: string, value: boolean | number | string) =>
  stepDev(w, cmd(w, { type: 'dev_set_fact', fact: ref('fact', key), value }), 1);
const code = ({ decision }: ReturnType<typeof go>) =>
  decision.kind === 'rejected' ? decision.error.code : decision.kind;
const room = (w: World, key: string) => w.roomIds[`toolbox_showcase@0.0.1:room/${key}`]!;
const body = (w: World) => bodyOf(w, w.character)!;
const sat = (w: World) => step(w, cmd(w, { type: 'sit' }), 1).world;

const patched = (w: World, state: object) => ({ ...w, state: { ...w.state, ...state } }) as World;

// Break: `step`, the path every other host and transcript takes, reaches the dev rule.
test('the ordinary step refuses both cheats', () => {
  const w = fresh();
  for (const payload of [
    { type: 'dev_go_to_room', room: ref('room', 'boar_run') },
    { type: 'dev_set_fact', fact: ref('fact', 'cellar_disarmed'), value: true },
  ])
    assert.equal(code(step(w, cmd(w, payload), 1)), 'permission_denied');
});

// Break: stepDev decides a command that is not a dev one, so a dev host's path widens.
test('stepDev refuses an ordinary command', () => {
  const w = fresh();
  assert.equal(code(stepDev(w, cmd(w, { type: 'look' }), 1)), 'permission_denied');
});

// Break: the body stays, or lands elsewhere.
test('go to room moves the body there', () => {
  const w = fresh();
  const out = go(w);
  assert.equal(code(out), 'accepted');
  assert.equal(out.world.state.containers[body(w)], room(w, 'boar_run'));
});

// Break: an unknown room or the room it is already in commits a move.
test('go to room refuses an unknown room and the same room', () => {
  const w = fresh();
  assert.equal(code(go(w, 'nowhere')), 'not_found');
  assert.equal(code(go(w, 'crossroads_inn')), 'invalid_state');
});

// Break: any one hold dropped lets the move leave that state wrong (a fight in the old room, water
// time in a room left, a route walked from nowhere).
const held: Record<string, (w: World) => World> = {
  engaged: (w) =>
    patched(w, { encounters: { e: { status: 'open', body_id: body(w), npc_id: 'n' } } }),
  'not standing': sat,
  'in water': (w) => patched(w, { water: { [w.character]: { room_id: 'r' } } }),
  'on patrol': (w) => patched(w, { patrols: { p: { actor_id: w.character, status: 'together' } } }),
  'awaiting a patrol': (w) =>
    patched(w, { patrols: { p: { actor_id: w.character, status: 'awaiting' } } }),
  'at an open choice': (w) =>
    patched(w, {
      choices: { c: { actor_id: w.character, status: 'pending', source: { kind: 'dialogue' } } },
    }),
  'at an open dream choice': (w) =>
    patched(w, {
      choices: { c: { actor_id: w.character, status: 'pending', source: { kind: 'scene' } } },
    }),
  'in a modal scene': (w) =>
    patched(w, {
      facts: {
        [`{"fact":{"cartridge_id":"toolbox_showcase","cartridge_version":"0.0.1","key":"scene_letter_read","kind":"fact"},"kind":"fact","scope":{"character_id":"${w.character}","kind":"player"}}`]: 1,
      },
    }),
};
for (const [name, hold] of Object.entries(held))
  test(`go to room refuses while ${name}`, () => {
    assert.equal(code(go(hold(fresh()))), 'invalid_state');
  });

// Break: a route bottom entered with no water row, which waterValid refuses on the next reopen.
test('go to room refuses a water route bottom, and goes to a room off the route', () => {
  const w = fresh();
  const flooded = (bottom: string) =>
    ({
      ...w,
      cartridge: {
        ...w.cartridge,
        world: { ...w.cartridge.world, water: { routes: [{ bottom: ref('room', bottom) }] } },
      },
    }) as unknown as World;
  assert.equal(code(go(flooded('boar_run'))), 'invalid_state');
  assert.equal(code(go(flooded('cellar'))), 'accepted');
});

// Another room of `w`, by ref read from the world, so a sampler's own cartridge can be asked.
const goElsewhere = (w: World, revision: number) => {
  const [cartridge_id, cartridge_version, key] = Object.keys(w.roomIds)
    .find((r) => w.roomIds[r] !== w.state.containers[body(w)])!
    .split(/@|:room\//);
  const room = { cartridge_id, cartridge_version, kind: 'room', key };
  return stepDev(w, cmd(w, { type: 'dev_go_to_room', room }), revision);
};

// Break: the expedition hold dropped: its route credits only walked edges, past the fight it opens.
test('go to room refuses on an active expedition', () => {
  let w = fragment('protocol/fixtures/expedition_sampler_hash.json').genesis();
  const cairn = Object.entries(w.details).find(([, d]) => d.key === 'cairn')![0];
  w = step(w, cmd(w, { type: 'expedition', detail_id: cairn, transition: 'start' }), 1).world;
  const fled = step(w, cmd(w, { type: 'flee' }), 2);
  assert.equal(fled.decision.kind, 'accepted'); // else the fight's hold answers, not this one
  assert.equal(code(goElsewhere(fled.world, 3)), 'invalid_state');
});

// Break: the travel hold dropped: the ridden horse stays behind in the old room.
test('go to room refuses while riding, and goes on foot', () => {
  const sampler = fragment('protocol/fixtures/mount_sampler_hash.json');
  assert.equal(code(goElsewhere(sampler.genesis(), 1)), 'accepted');
  const ridden = sampler.genesis((c: any) => {
    c.facts['mount_sampler@0.0.1:fact/riding'].value_type.default = true;
  });
  assert.equal(code(goElsewhere(ridden, 1)), 'invalid_state');
});

// Break: go-to moves the body without its entered event, so room reactions silently stop firing.
test('go to room announces the entry, and a room reaction springs', () => {
  const out = go(fresh(), 'sapper_cellar');
  assert.equal(code(out), 'accepted');
  const cellarSprung = Object.entries(out.world.state.facts ?? {}).filter(([k]) =>
    k.includes('"key":"cellar_sprung"'),
  );
  assert.deepEqual(
    cellarSprung.map(([, v]) => v),
    [true],
  );
});

// Break: the value is not stored, or the ordinary assignment is bypassed.
test('set fact stores the value', () => {
  const w = fresh();
  const out = set(w, 'cellar_disarmed', true);
  assert.equal(code(out), 'accepted');
  assert.deepEqual(out.world.state.facts, {
    '{"fact":{"cartridge_id":"toolbox_showcase","cartridge_version":"0.0.1","key":"cellar_disarmed","kind":"fact"},"kind":"fact","scope":{"kind":"instance","world_context_id":"0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f"}}': true,
  });
  assert.equal(code(set(out.world, 'cellar_disarmed', true)), 'invalid_state'); // already that value
});

// Break: a refusal dropped lets a cheat write what only its mechanic may, or an ill-typed value.
test('set fact refuses unknown, ill-typed, reserved and owned facts', () => {
  const w = fresh();
  assert.equal(code(set(w, 'no_such', true)), 'not_found');
  assert.equal(code(set(w, 'cellar_disarmed', 3)), 'invalid_state');
  assert.equal(code(set(w, 'position', 'sitting')), 'invalid_state');
  assert.equal(code(set(w, 'scene_letter_read', 1)), 'invalid_state');
  assert.equal(code(set(w, 'skill_blade', true)), 'invalid_state'); // the skills mechanic owns it
});

// Break: one load proof's fact stops being refused, so the cheat leaves a save that never reopens.
test('set fact refuses every fact a reopen proves from its mechanic, and only those', () => {
  const fact = ref('fact', 'cellar_disarmed');
  const other = ref('fact', 'other');
  const carried = (extra: object) => ({
    dialogues: {
      d: {
        choices: {
          c: { ...extra, steps: [{ op: 'fact.assign', fact, value: true }] },
        },
      },
    },
  });
  const owned = [
    carried({ escort: {} }),
    { quests: { q: { deadline: { fact, trust_fact: other } } } },
    { quests: { q: { deadline: { fact: other, trust_fact: fact } } } },
    { quests: { q: { expedition: { survived_fact: fact, faction: other } } } },
    { quests: { q: { expedition: { survived_fact: other, faction: fact } } } },
  ];
  const under = (patch: object) => {
    const w = fresh();
    return { ...w, cartridge: { ...w.cartridge, ...patch } } as unknown as World;
  };
  for (const patch of owned)
    assert.equal(code(set(under(patch), 'cellar_disarmed', true)), 'invalid_state');
  // Break: a term with no reopen proof (#544 removed them) comes back and blocks a harmless cheat.
  const accepted = [
    carried({}),
    carried({ receive: { item: 'it' } }),
    {
      dialogues: {
        d: {
          riddle: { choice_id: 'c', wrong_limit: 1 },
          choices: { c: { steps: [{ op: 'fact.assign', fact, value: true }] } },
        },
      },
    },
    { npcs: { n: { perception: { discovered: fact } } } },
    { topics: { t: { fact } } },
  ];
  for (const patch of accepted)
    assert.equal(code(set(under(patch), 'cellar_disarmed', true)), 'accepted');
  // Break: an absent optional trust_fact reaches refString and the cheat throws.
  const noTrust = { quests: { q: { deadline: { fact: other } } } };
  assert.equal(code(set(under(noTrust), 'cellar_disarmed', true)), 'accepted');
});

// Break: the trace replay (Why, bin/play) re-decides a preview's cheat through `step`, which refuses it.
test('a trace replay re-decides a cheat', () => {
  const w = fresh();
  const r = start(w.cartridge, 'h', 'r', w.context, [1, 2, 3, 4], 'v');
  const { decision } = decideReplay(
    r,
    cmd(r.world, { type: 'dev_set_fact', fact: ref('fact', 'cellar_disarmed'), value: true }),
  );
  assert.equal(decision.kind, 'accepted');
});

// Break: a hand-edited step's targets, which a cheat has no slot for, are dropped silently.
test('a cheat invocation with targets does not resolve', () => {
  const w = fresh();
  const invocation = {
    invocation_id: 'i',
    actor_id: w.character,
    action_key: 'dev_go_to_room',
    target_ids: [],
    input: { room: ref('room', 'boar_run') },
  };
  const id = {
    invocation,
    command_id: 'e5f6a7b8-c9d0-4e1f-8a2b-4c5d6e7f8a9b',
  } as unknown as Parameters<typeof resolveDev>[1];
  const bad = {
    invocation: { ...invocation, target_ids: ['x'] },
    command_id: 'e5f6a7b8-c9d0-4e1f-8a2b-4c5d6e7f8a9b',
  } as unknown as Parameters<typeof resolveDev>[1];
  assert.equal('payload' in resolveDev(w, id), true);
  assert.deepEqual(resolveDev(w, bad), {
    kind: 'rejected',
    error: { code: 'unsupported_capability' },
  });
});

// Break: a per-subject fact has no one value to set; the cheat would throw, a fault, not a refusal.
test('set fact refuses a per-subject fact', () => {
  const w = fresh();
  const at = 'toolbox_showcase@0.0.1:fact/cellar_disarmed';
  const facts = { ...w.cartridge.facts, [at]: { ...w.cartridge.facts[at]!, per_subject: true } };
  const subjects = { ...w, cartridge: { ...w.cartridge, facts } } as World;
  assert.equal(code(set(subjects, 'cellar_disarmed', true)), 'invalid_state');
});
