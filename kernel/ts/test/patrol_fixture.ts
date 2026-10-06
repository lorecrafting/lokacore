import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { read } from './read.ts';
import { encode } from '../src/foundation/canonical.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  step,
  type Cartridge,
  type World,
} from '../src/index.ts';
import type { Command, DefinitionRef } from '../src/contracts.gen.ts';

/** Provisional authored C2 overlay; final chapter pins wait for reviewed B6/B7. */
export function patrolBundle() {
  const c = structuredClone(read('protocol/fixtures/missing_child_v021_hash.json').value);
  const named = (kind: string, key: string) =>
    `${c.manifest.id}@${c.manifest.version}:${kind}/${key}`;
  const ref = (kind: string, key: string) => ({
    cartridge_id: c.manifest.id,
    cartridge_version: c.manifest.version,
    kind,
    key,
  });
  const source = (file: string) => read(`cartridges/ashmere_missing_child/${file}`);
  c.manifest.requires.capabilities.patrol = c.lock.capabilities.patrol = 1;
  for (const key of [
    'watch_post',
    'watch_cell',
    'gate_tower',
    'east_gate',
    'north_gate',
    'village_green',
  ]) {
    const r = source(`rooms/${key}.json`);
    for (const e of Object.values(r.exits) as any[]) e.to = ref('room', e.to);
    // Existing description variants retain their original, already expanded predecessor values.
    if (r.variants) r.variants = c.rooms[named('room', key)].variants;
    c.rooms[named('room', key)] = { key, ...r };
  }
  c.npcs[named('npc', 'tobin')].room = ref('room', 'watch_post');
  const q = source('quests/watch_rounds.json');
  q.patrol.npc = ref('npc', q.patrol.npc);
  q.patrol.trust_fact = ref('fact', q.patrol.trust_fact);
  for (const field of ['route', 'checkpoints'])
    q.patrol[field] = q.patrol[field].map((k: string) => ref('room', k));
  c.quests[named('quest', 'watch_rounds')] = { key: 'watch_rounds', ...q };
  c.facts[named('fact', 'watch_gate_trusts_player')] = {
    key: 'watch_gate_trusts_player',
    ...source('facts.json').facts.watch_gate_trusts_player,
  };
  const d = source('dialogues/tobin_watch.json');
  d.npc = ref('npc', d.npc);
  for (const r of Object.values(d.roles) as any[]) r.npc = ref('npc', r.npc);
  for (const o of Object.values(d.choices) as any[]) {
    o.patrol.quest = ref('quest', o.patrol.quest);
    if (o.accept) o.accept = ref('quest', o.accept);
  }
  c.dialogues[named('dialogue', 'tobin_watch')] = { key: 'tobin_watch', ...d };
  // Until B6 exact selection is integrated, this controlled consumer selects only patrol.
  delete c.dialogues[named('dialogue', 'tobin_swords')];
  delete c.dialogues[named('dialogue', 'tobin_dodge')];
  c.text = source('text.json');
  const canonical = encode(c);
  return { value: c, canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
}
export const bundle = patrolBundle();
const loaded = loadCartridge(
  new TextEncoder().encode(
    JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
  ),
  INSTALLED,
);
assert.ok(loaded.ok, JSON.stringify(loaded));
export const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
export const ref = (world: World, kind: string, key: string): DefinitionRef => ({
  cartridge_id: world.cartridge.manifest.id,
  cartridge_version: world.cartridge.manifest.version,
  kind: kind as never,
  key: key as never,
});
export const room = (w: World, key: string) =>
  w.roomIds[`${w.cartridge.manifest.id}@${w.cartridge.manifest.version}:room/${key}`];
export const npc = (w: World, key = 'tobin') =>
  w.entityIds[`${w.cartridge.manifest.id}@${w.cartridge.manifest.version}:npc/${key}`];
export const patrol = (w: World) => Object.values(w.state.patrols ?? {})[0];
export function journey(world = fresh) {
  let w = world,
    n = 0;
  const run = (p: object, accept = true) => {
    const command = {
      id: `abababab-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p },
    } as Command;
    const result = step(w, command, n);
    if (accept) assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
    w = result.world;
    return result;
  };
  const move = (direction: string) => run({ type: 'move', direction });
  const choice = (choice_id: string, input?: object) => {
    run({ type: 'talk', target_id: npc(w) });
    const row = Object.entries(w.state.choices!).find(([, c]) => c.status === 'pending')!;
    const p = patrol(w);
    return run({
      type: 'choose',
      continuation_id: row[0],
      choice_id,
      ...(p && {
        patrol: {
          quest_instance_id: p.quest_instance_id,
          attempt_id: p.attempt_id,
          cursor: p.cursor,
          status: p.status,
        },
      }),
      ...input,
    });
  };
  const start = () => {
    for (const d of ['north', 'north', 'north', 'east']) move(d);
    choice('start');
  };
  return {
    run,
    move,
    choice,
    start,
    get world() {
      return w;
    },
  };
}
