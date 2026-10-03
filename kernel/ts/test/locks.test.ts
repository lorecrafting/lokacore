// Locked containers (c1-locks; mechanics.md barrier@1 and containment@1 custody; protocol.md
// GameView): the door verbs on an item by invocation (identify, resolve, step), take through
// containers, the GameView's container state, verbs and contents, and the loader's item barrier
// checks. The world is the locks known answer (protocol/fixtures/cartridge_locks_hash.json),
// changed and re-hashed with node:crypto for the loader cases. Expected ids are Python hashlib
// over the IdSource input (the wear fixture's description holds the code), never the kernel's;
// codes, ops and views are hand-derived from the cartridge files and the clauses above.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Command, EntityView, GameView } from '../src/contracts.gen.ts';
import { encode } from '../src/canonical.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { resolved } from '../src/actions.ts';
import { refStage } from '../src/cartridge_refs.ts';
import { identify, resolve } from '../src/invocation.ts';
import { check } from '../src/invariants.ts';
import { gameView, holds, INSTALLED, newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const BODY = '3d4829ad-9e43-81ef-bc10-66b1b267e157'; // 1
const MAUD = '953a909b-3a29-8c5c-9e3f-4105b9a47c4b'; // 4
const KEY = 'ff864ad5-cd56-80c8-9392-dc88bdc28fd2'; // 5 brass_key
const COFFER = '6a70d262-b6ea-8b64-9809-ec7f79d1521e'; // 6
const LETTER = '0f5f2329-bcff-82f4-948a-3d22a75fb068'; // 7
const LOCKET = 'd530207e-b845-8be5-9d53-b44b2cf5d8a1'; // 8
const PENNY = '2ef35eee-f837-8b28-bea7-9748a332940a'; // 9
const PURSE = '470b4175-5b92-89c1-bdac-645a128dc72f'; // 10
const RIBBON = 'f34698e2-c92c-841a-b0bd-da6883e9c111'; // 11
const BOX = '15349791-fa65-81f7-b378-bb8212b808d2'; // 12 sewing_box
const TRUNK = 'e368b8b9-c4a5-8d0e-82a0-da17e2d59fe2'; // 13
const L = 'ashmere_locks@0.0.1';
const lid = (key: string) => ({
  cartridge_id: 'ashmere_locks',
  cartridge_version: '0.0.1',
  kind: 'barrier',
  key,
});

// The fixture's artifact (its value changed by `f` and re-hashed), loaded or its first diagnostic.
const load = (f?: (c: any) => void) => {
  const kat = read('protocol/fixtures/cartridge_locks_hash.json');
  let [text, h] = [kat.canonical, kat.sha256];
  if (f) {
    const c = structuredClone(kat.value);
    f(c);
    text = encode(c);
    h = createHash('sha256').update(text).digest('hex');
  }
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`),
    INSTALLED,
  );
};
const fresh = (): World => {
  const loaded = load();
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], [1, 2, 3, 4]);
};

// One invocation through identify, resolve and step, with the containment invariants and
// gameview_agrees_with_admission checked against the view before it.
function invoke(w: World, action_key: string, target_ids: string[], input = {}) {
  const value = { invocation_id: CONTEXT, actor_id: w.character, action_key, target_ids, input };
  const id = identify('scope', w.character, value);
  if (id.kind !== 'identified') throw new Error(JSON.stringify(id));
  const command = resolve(w, id);
  if ('kind' in command) return { decision: command, world: w };
  const s = step(w, command, 0, action_key as never);
  const resolves = Object.fromEntries(
    Object.values(resolved(w, w.character)).map((a) => [a.key, a.command]),
  );
  const observation = { view: gameView(w), command, decision: s.decision, resolves };
  assert.ok(check('gameview_agrees_with_admission', observation), `${action_key} ${target_ids}`);
  for (const i of ['one_container_per_item', 'containment_acyclic'])
    assert.ok(holds(i, s.world), `${i} after ${action_key}`);
  return s;
}
type Row = [string, string, string]; // action key, target id, outcome or refusal code
// Runs `rows` from `w`: each accepted with its outcome, or refused with its code and no change.
function run(w: World, rows: Row[]) {
  for (const [key, id, want] of rows) {
    const s = invoke(w, key, [id]);
    const got =
      s.decision.kind === 'accepted' ? s.decision.outcome : (s.decision as any).error.code;
    assert.equal(got, want, `${key} ${id}`);
    if (s.decision.kind !== 'accepted') assert.equal(s.world, w, `${key} ${id} changed the world`);
    w = s.world;
  }
  return w;
}
const up = (w: World) => invoke(w, 'move', [], { direction: 'up' }).world;
const ops = (w: World, key: string, id: string) => {
  const d = invoke(w, key, [id]).decision;
  return JSON.parse(
    JSON.stringify(d.kind === 'accepted' ? [d.delta.ops, d.events.map((e) => e.payload)] : d),
  );
};

// Breaks: reach ignoring a lid, an NPC or a lid further up; a container verb not resolved from
// target_ids (TARGETS), refused on a reachable lid, or accepted without its key; a transition or
// transfer with the wrong barrier, states or source.
test('the chapter walk: lids opened, unlocked and closed by invocation, take through them', () => {
  let w = run(fresh(), [['take', KEY, 'not_present']]);
  const box = lid('box_lid');
  assert.deepEqual(ops(w, 'open', BOX), [
    [{ op: 'barrier.transition', writer_group: 0, barrier: box, from: 'closed', to: 'open' }],
    [{ type: 'barrier_changed', barrier: box, from: 'closed', to: 'open' }],
  ]);
  w = run(w, [['open', BOX, 'opened']]);
  const transfer = (entity_id: string, source_id: string) => [
    { op: 'entity.transfer', writer_group: 0, entity_id, source_id, destination_id: BODY },
  ];
  assert.deepEqual(ops(w, 'take', KEY)[0], transfer(KEY, BOX));
  w = run(w, [
    ['take', KEY, 'taken'],
    ['close', BOX, 'closed'],
    ['lock', BOX, 'not_owned'], // box_lid has no key_item
    ['take', PENNY, 'not_present'], // in Maud's purse
    ['take', PURSE, 'not_present'], // Maud holds it
  ]);
  w = run(up(w), [
    ['take', LETTER, 'not_present'],
    ['open', TRUNK, 'exit_locked'],
    ['unlock', TRUNK, 'unlocked'],
    ['open', TRUNK, 'opened'],
    ['take', LETTER, 'taken'],
    ['take', LOCKET, 'not_present'],
    ['open', COFFER, 'opened'],
  ]);
  assert.deepEqual(ops(w, 'take', LOCKET)[0], transfer(LOCKET, COFFER));
  w = run(w, [
    ['take', LOCKET, 'taken'],
    ['close', TRUNK, 'closed'],
    ['take', RIBBON, 'not_present'], // the coffer is open, the trunk above it closed
    ['take', TRUNK, 'taken'],
    ['open', TRUNK, 'opened'],
  ]);
  assert.deepEqual(ops(w, 'take', RIBBON)[0], transfer(RIBBON, COFFER)); // from a held trunk
});

// Breaks: the target form accepting neither or both of direction and target_id, a non-item or
// lidless item, an item out of reach, or an exit without a barrier; a second target id dropped.
test('a door verb names exactly one barrier: each bad shape is refused with its code', () => {
  const attic = up(
    run(fresh(), [
      ['open', BOX, 'opened'],
      ['take', KEY, 'taken'],
    ]),
  );
  const opened = run(attic, [
    ['unlock', TRUNK, 'unlocked'],
    ['open', TRUNK, 'opened'],
  ]);
  const actor_id = attic.character;
  const cmd = (w: World, p: object) =>
    step(w, { id: CONTEXT, world_context_id: w.context, payload: { actor_id, ...p } } as Command, 0)
      .decision;
  const rows: [World, object, string][] = [
    [attic, { type: 'open' }, 'invalid_target'],
    [attic, { type: 'open', direction: 'down', target_id: TRUNK }, 'invalid_target'],
    [fresh(), { type: 'open', target_id: MAUD }, 'invalid_target'],
    [opened, { type: 'open', target_id: LETTER }, 'invalid_target'], // in reach, no lid
    [fresh(), { type: 'open', direction: 'up' }, 'invalid_target'], // an exit, no barrier
    [attic, { type: 'open', target_id: '11111111-2222-4333-8444-555555555555' }, 'not_found'],
    [fresh(), { type: 'open', target_id: TRUNK }, 'not_present'], // in the attic
  ];
  for (const [w, p, code] of rows)
    assert.deepEqual(cmd(w, p), { kind: 'rejected', error: { code } }, JSON.stringify(p));
  const two = invoke(attic, 'open', [TRUNK, COFFER]).decision;
  assert.deepEqual(two, { kind: 'rejected', error: { code: 'unsupported_capability' } });
});

// Breaks: has_item made custodial, so a key locked inside a held chest no longer counts.
test('a key inside a held, locked trunk still unlocks it (has_item unchanged)', () => {
  const w = fresh();
  const containers = { ...w.state.containers, [TRUNK]: BODY, [KEY]: TRUNK } as never;
  run({ ...w, state: { ...w.state, containers } }, [['unlock', TRUNK, 'unlocked']]);
});

const verb = (action_key: string, scope = 'room_contents') => ({
  available: true,
  action_key,
  label: `action.${action_key}`,
  target: { kind: 'entity', scopes: [scope] },
  input: [],
});
const entity = (v: GameView, id: string) => v.entities.find((e) => e.id === id);

// Breaks: a lid's state or verbs missing or listed when step would refuse them (no key, wrong
// state), contents shown behind a closed lid or for an NPC, nested containers flattened without
// their container, or container verbs among the place's actions.
test('the GameView shows a lid, the verbs step accepts on it and what is in reach inside', () => {
  const w = fresh();
  assert.deepEqual(entity(gameView(w), BOX), {
    id: BOX,
    name: 'item.sewing_box.short',
    kind: 'item',
    state: 'closed',
    actions: [verb('open'), verb('take')],
  });
  assert.deepEqual(entity(gameView(w), MAUD), {
    id: MAUD,
    name: 'npc.maud.short',
    kind: 'npc',
    actions: [],
  });
  const open = run(w, [['open', BOX, 'opened']]);
  assert.deepEqual(entity(gameView(open), BOX), {
    id: BOX,
    name: 'item.sewing_box.short',
    kind: 'item',
    state: 'open',
    actions: [verb('close'), verb('take')],
    contents: [
      {
        id: KEY,
        name: 'item.brass_key.short',
        kind: 'item',
        container_id: BOX,
        actions: [verb('take')],
      },
    ],
  });
  const trunk = (w: World) => entity(gameView(w), TRUNK) as EntityView;
  const keyless = up(w);
  assert.deepEqual([trunk(keyless).state, trunk(keyless).actions], ['locked', [verb('take')]]);
  const keyed = up(run(open, [['take', KEY, 'taken']]));
  assert.deepEqual(trunk(keyed).actions, [verb('take'), verb('unlock')]);
  const unlocked = run(keyed, [['unlock', TRUNK, 'unlocked']]);
  assert.deepEqual(trunk(unlocked).actions, [verb('lock'), verb('open'), verb('take')]);
  const inside = run(unlocked, [['open', TRUNK, 'opened']]);
  const item = (id: string, key: string, container_id: string, more = {}) => ({
    id,
    name: `item.${key}.short`,
    kind: 'item',
    container_id,
    ...more,
    actions: [verb('take')],
  });
  const coffer = { state: 'closed', actions: [verb('open'), verb('take')] };
  assert.deepEqual(trunk(inside).contents, [
    { ...item(COFFER, 'coffer', TRUNK), ...coffer },
    item(LETTER, 'letter', TRUNK),
  ]);
  const both = run(inside, [['open', COFFER, 'opened']]);
  assert.deepEqual(
    trunk(both).contents!.map((c) => [c.id, c.container_id]),
    [
      [COFFER, TRUNK],
      [LETTER, TRUNK],
      [LOCKET, COFFER],
      [RIBBON, COFFER],
    ],
  );
  const doors = ['open', 'close', 'lock', 'unlock'];
  for (const s of [w, open, keyless, keyed, unlocked, inside, both])
    assert.ok(!gameView(s).actions.some((a) => doors.includes(a.action_key)));
});

// The first loader diagnostic of the locks value changed by `f`.
const first = (f: (c: any) => void) => {
  const r = load(f);
  return r.ok ? 'loaded' : (r as any).diagnostic;
};
const item = (c: any, key: string) => c.items[`${L}:item/${key}`];
const barrier = (c: any, key: string) => c.barriers[`${L}:barrier/${key}`];
const inItem = (key: string) => ({ in: 'item', item: { ...lid(key), kind: 'item' } });
const diag = (code: string, path: string, data = {}) => ({
  severity: 'error',
  code,
  path,
  message_key: `diagnostics.${code.toLowerCase()}`,
  data,
  suggested_capabilities: [],
});
const unreachable = (key: string) =>
  diag('BARRIER_UNREACHABLE_KEY', `.cartridge.barriers["${L}:barrier/${key}"]`);

// Breaks: lockout treating a locked chest's contents as in reach, skipping item barriers or a
// missing key_item, rejecting keys that are reachable, or the item's barrier not a checked
// reference with one site.
test('the loader rejects only keys that can never be reached, and checks an item barrier', () => {
  assert.equal(
    first(() => {}),
    'loaded',
  ); // a key in a closed, unlocked chest
  const ownKey = (c: any) => (item(c, 'brass_key').location = inItem('trunk'));
  assert.deepEqual(first(ownKey), unreachable('trunk_lid'));
  const circular = (c: any) => {
    Object.assign(barrier(c, 'box_lid'), { initial: 'locked', key_item: inItem('letter').item });
  };
  const all = (f: (c: any) => void) => {
    const c = JSON.parse(read('protocol/fixtures/cartridge_locks_hash.json').canonical);
    f(c);
    return refStage(c).filter((d) => d.code === 'BARRIER_UNREACHABLE_KEY');
  };
  assert.deepEqual(all(circular), [unreachable('box_lid'), unreachable('trunk_lid')]);
  const keyless = (c: any) => (barrier(c, 'coffer_lid').initial = 'locked');
  assert.deepEqual(first(keyless), unreachable('coffer_lid'));
  const keyed = (c: any) =>
    Object.assign(barrier(c, 'coffer_lid'), { initial: 'locked', key_item: inItem('penny').item });
  assert.deepEqual(first(keyed), unreachable('coffer_lid')); // penny is Maud's
  const reachable = (c: any) =>
    Object.assign(barrier(c, 'coffer_lid'), { initial: 'locked', key_item: inItem('letter').item });
  assert.equal(first(reachable), 'loaded'); // letter is in the trunk, whose key is in reach
  // A locked hatch up whose key is in the box, locked with the letter in the attic beyond it.
  const hatch = (c: any) => {
    const b = { key: 'hatch', keywords: ['hatch'], short: 'barrier.box_lid.short' };
    c.barriers[`${L}:barrier/hatch`] = {
      ...b,
      initial: 'locked',
      key_item: inItem('brass_key').item,
    };
    c.rooms[`${L}:room/inn_rooms`].exits.up.barrier = lid('hatch');
    c.rooms[`${L}:room/inn_attic`].exits.down.barrier = lid('hatch');
    Object.assign(barrier(c, 'box_lid'), { initial: 'locked', key_item: inItem('letter').item });
  };
  assert.deepEqual(all(hatch), [unreachable('hatch'), unreachable('box_lid')]);
  const shared = (c: any) => {
    c.rooms[`${L}:room/inn_rooms`].exits.up.barrier = lid('trunk_lid');
    c.rooms[`${L}:room/inn_attic`].exits.down.barrier = lid('trunk_lid');
  };
  const trunk = `.cartridge.items["${L}:item/trunk"].barrier`;
  assert.deepEqual(first(shared), diag('BARRIER_MISMATCH', trunk));
  const unknown = (c: any) => (item(c, 'trunk').barrier = lid('nope'));
  assert.deepEqual(
    first(unknown),
    diag('UNRESOLVED_REFERENCE', trunk, { target: `${L}:barrier/nope` }),
  );
});
