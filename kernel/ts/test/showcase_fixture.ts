// The toolbox showcase (cartridges/toolbox_showcase, docs/SHOWCASE.md) from its pinned compiled
// answer, and the play helpers its district walkthroughs share. test/loka/content_showcase_test.exs
// holds the source to the same bytes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gameView, INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { decode, encode } from '../src/foundation/canonical.ts';
import { pending, spokenBy } from '../src/mechanics/dialogue/shared.ts';
import { disposition } from '../src/mechanics/disposition.ts';

const kat = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/toolbox_showcase_hash.json', import.meta.url),
    'utf8',
  ),
) as { canonical: string; sha256: string };
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok, JSON.stringify(loaded));
export const content = loaded.cartridge as Cartridge;

export const HOUR = 3600;
export const DAY = 24 * HOUR;
export const fresh = (context: string) => newWorld(content, context as never, [1, 2, 3, 4]);
export const ref = (kind: string, key: string) => `toolbox_showcase@0.0.1:${kind}/${key}`;
export const id = (w: World, kind: string, key: string) => w.entityIds[ref(kind, key)]!;
/** The id of the detail with this key in the player's room. */
export function detail(w: World, key: string) {
  const here = w.state.containers[w.body];
  const found = Object.keys(w.details).find(
    (k) => w.details[k].key === key && w.details[k].room === here,
  );
  assert.ok(found, `no detail ${key} here`);
  return found;
}
export const pool = (w: World, key: string) => level(w, w.body, resourceRef(w, key));
export const labels = (w: World) => gameView(w).conditions?.map((c) => c.label as string) ?? [];
export const attribute = (w: World, key: string) =>
  gameView(w).attributes?.find((a) => a.attribute.key === key)?.value;

let n = 0;
/** One player command; the decision and the world after it (unchanged when refused). */
export function act(w: World, p: object) {
  n += 1;
  const r = step(
    w,
    {
      id: `5ca5e000-5555-4333-8444-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
  const narration = r.decision.kind === 'accepted' ? (r.decision.narration ?? []) : [];
  return { decision: r.decision, world: r.world, lines: narration.map((l) => l.key as string) };
}
/** An accepted command's world and narration keys. */
export function play(w: World, p: object) {
  const r = act(w, p);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
}
export const go = (w: World, direction: string) => play(w, { type: 'move', direction });
export const take = (w: World, item: string) =>
  play(w, { type: 'take', item_id: id(w, 'item', item) }).world;
export const perform = (w: World, action: string) => play(w, { type: 'perform', action });
/** The refusal code of a command the rules must refuse. */
export function refused(w: World, p: object) {
  const r = act(w, p);
  assert.equal(r.decision.kind, 'rejected', JSON.stringify(r.decision));
  return (r.decision as unknown as { error: { code: string } }).error.code;
}

/**
 * As the host (mobile/authority/local-story/elapsed.ts): elapsed steps to `target`, stopping at each
 * pending job but the calendar job; every narration key and event payload on the way.
 */
export function wait(w: World, target: number) {
  const lines: string[] = [];
  const events: { type: string; [k: string]: unknown }[] = [];
  while (w.state.clock < target) {
    const until = Object.values(w.state.jobs ?? {})
      .filter(
        (j) => j.status === 'pending' && j.job.kind !== 'calendar' && j.due_time > w.state.clock,
      )
      .reduce((t, j) => Math.min(t, j.due_time), target);
    n += 1;
    const run_id = 'aaaaaaaa-0000-4000-8000-00000000005c';
    const r = stepElapsed(
      w,
      {
        id: elapsedCommandId(run_id, w.context, w.state.clock, until) as never,
        world_context_id: w.context,
        payload: { type: 'elapsed', actor_id: w.character, run_id, from: w.state.clock, until },
      } as never,
      n,
    );
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    if (r.decision.kind === 'accepted') {
      lines.push(...(r.decision.narration ?? []).map((l) => l.key as string));
      events.push(...r.decision.events.map((e) => e.payload as never));
    }
    w = r.world;
  }
  return { world: w, lines, events };
}

// Low Wardle: the helpers showcase_social and showcase_consequence share.
export const SOCIAL = '5ca5e000-0000-4000-8000-00000000032e';
export const green = (ctx = SOCIAL) => go(fresh(ctx), 'south').world;
/** A fact's value for `key` (and, for a pair or entity fact, `subject`'s row); undefined if unset. */
export const fact = (w: World, key: string, subject?: string) =>
  Object.entries(w.state.facts ?? {}).find(([k]) => {
    const t = decode(k) as { fact: { key: string }; subject_id?: string };
    return t.fact.key === key && (subject === undefined || t.subject_id === subject);
  })?.[1];
export const npc = (w: World, k: string) => id(w, 'npc', k);
export const where = (w: World, k: string) => w.state.containers[k];
export const room = (w: World, k: string) => w.roomIds[`toolbox_showcase@0.0.1:room/${k}`];
/** Talk to `who`; the dialogue that opened and the world with the choice pending. */
export function talk(w: World, who: string) {
  const r = play(w, { type: 'talk', target_id: npc(w, who) });
  return { world: r.world, opened: spokenBy(w, w.character, npc(w, who))?.key };
}
export function choose(w: World, choice_id: string) {
  const [continuation_id] = pending(w, w.character)!;
  return play(w, { type: 'choose', choice_id, continuation_id });
}
// An accepted decision's outcome.
export const outcome = (r: ReturnType<typeof play>) =>
  r.decision.kind === 'accepted' ? r.decision.outcome : undefined;
// Pick `choice` from `who`'s dialogue, talking first unless its hub is still open.
export const say = (w: World, who: string, choice: string) =>
  choose(pending(w, w.character) ? w : talk(w, who).world, choice);
// Leave the conversation, as the Book's foot does (the showcase authors no Leave choice).
export const leave = (w: World) =>
  play(w, { type: 'close_choice', continuation_id: pending(w, w.character)![0] }).world;
export const mood = (w: World, who: string) => disposition(w, w.character, npc(w, who));
export const topics = (w: World) => (gameView(w).topics ?? []).map((t) => t.label as string);

/** The showcase, edited and re-hashed, loaded: its first diagnostic's code and path, or 'ok'. */
export function reload(edit: (c: any) => void) {
  const c = structuredClone(content) as any;
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  return r.ok ? 'ok' : `${r.diagnostic.code} ${r.diagnostic.path}`;
}

// The Homestead (crafts 1.101; build, raze, item_present, profession, hidden: 1.102) and the
// Undercroft's gated parts, the wanted icon and the golem's observed lines (1.110) dropped for the older-floor
// loader rows; twin of homestead/0 in test/loka/content_showcase_test.exs.
export function homestead(c: any) {
  delete c.world.construction;
  delete c.rooms[ref('room', 'holding_lane')].site;
  delete c.npcs[ref('npc', 'carpenter')].services;
  delete c.rooms[ref('room', 'holding_croft')].site;
  for (const k of [
    'crate',
    'hall_strongbox',
    'hoard_chest',
    'npc_corpse',
    'player_corpse',
    'strongbox',
    'strongroom_chest',
    'yard_crate',
  ])
    delete c.items[ref('item', k)].immune; // the sow statuses are dropped
  for (const s of ['afraid', 'burning', 'wet', 'shocked', 'stunned', 'warm'])
    delete c.statuses[ref('status', s)].narration.observed; // 1.110 (loka-kgd.176, loka-y6yg.48)
  delete c.statuses[ref('status', 'wanted')].kind; // 1.102 (the law's wanted icon, E1)
  delete c.items[ref('item', 'training_sword')].equip; // 1.116 (loka-x6t.20)
  delete c.world.death.narration; // 1.117 (loka-3w3q)
  // The traps district's narrate lines and wheel readouts (1.103) and lever hall asides (1.91);
  // the Loft's errand handover line (1.103).
  delete c.rooms[ref('room', 'lever_hall')].asides;
  for (const r of [
    'lever_b_step',
    'lever_b_reset',
    'lever_c_step',
    'lever_c_reset',
    'plate_springs',
    'plate_bites',
    'cellar_springs',
    'cellar_bites',
    'errand_reward',
  ]) {
    const x = c.reactions[ref('reaction', r)];
    x.apply = x.apply.filter((op: any) => op.op !== 'narrate');
  }
  for (let w = 1; w <= 3; w++)
    for (let k = 0; k <= 9; k++) delete c.reactions[ref('reaction', `wheel_${w}_x_shows_${k}`)];
  const drop = {
    blueprints: ['blueprint/hut_plain', 'blueprint/hut_timbered'],
    actions: [
      'action/raise_hut_plain',
      'action/raze_hut',
      'action/barter',
      'action/buy_pen',
      'action/buy_plot',
      'action/claim',
      'action/commission',
      'action/raise_croft_hut',
      'action/raze_croft_hut',
    ],
    services: [
      'service/raise_hut_plain',
      'service/raze_hut',
      'service/buy_pen',
      'service/buy_plot',
      'service/claim',
      'service/knife_for_pelts',
      'service/raise_croft_hut',
      'service/raze_croft_hut',
      'service/stew',
    ],
    recipes: [
      'recipe/chop',
      'recipe/saw',
      'recipe/carve_spoon',
      'recipe/raise_timbered_hut',
      'recipe/cook_feast',
      'recipe/cook_stew',
      'recipe/cook_stew_croft',
      'recipe/fish',
      'recipe/fish_croft',
      'recipe/water_croft',
      'recipe/water_plot',
    ],
    reactions: [
      'reaction/cot_rest',
      'reaction/croft_bite',
      'reaction/croft_cot_rest',
      'reaction/eel',
      'reaction/farmer_hates_rat',
      'reaction/farmer_likes_apple',
      'reaction/feed',
      'reaction/lay',
      'reaction/ripen_croft',
      'reaction/ripen_plot',
      'reaction/salmon',
      'reaction/sow',
      'reaction/spoil',
      'reaction/take_eel_01',
      'reaction/take_salmon_01',
      'reaction/take_trout_01',
      'reaction/take_trout_02',
      'reaction/trout',
      'reaction/water_croft',
      'reaction/water_plot',
      'reaction/wither_croft',
      'reaction/wither_plot',
    ],
    dialogues: ['dialogue/cook_lesson'],
    items: [
      'item/cot_2',
      'item/croft_plot',
      'item/dead_rat',
      'item/eel_01',
      'item/egg_01',
      'item/egg_02',
      'item/egg_03',
      'item/egg_04',
      'item/egg_05',
      'item/egg_06',
      'item/feast_01',
      'item/feather',
      'item/grain_01',
      'item/holding_apple',
      'item/knife_01',
      'item/nest',
      'item/pelt_01',
      'item/pelt_02',
      'item/pelt_03',
      'item/plot',
      'item/pond_water',
      'item/rod',
      'item/rod_2',
      'item/sack',
      'item/salmon_01',
      'item/seed_01',
      'item/stew_hearty_01',
      'item/stew_hearty_02',
      'item/stew_hearty_03',
      'item/stew_plain_01',
      'item/stick_03',
      'item/stick_04',
      'item/trough',
      'item/trout_01',
      'item/trout_02',
      'item/turnip_01',
      'item/turnip_02',
      'item/turnip_03',
      'item/watering_can',
    ],
    npcs: ['npc/cook', 'npc/farmer', 'npc/hen'],
    population_bundles: ['population_bundle/hens'],
    populations: ['population/hens'],
    replenish: [
      'replenish/croft_fish',
      'replenish/crop_croft',
      'replenish/crop_plot',
      'replenish/eel',
      'replenish/eggs',
      'replenish/grain_return',
      'replenish/restock',
      'replenish/salmon',
      'replenish/seed_return',
      'replenish/spent_croft',
      'replenish/spent_grain',
      'replenish/spent_plot',
      'replenish/trout',
    ],
    statuses: [
      'status/fed',
      'status/growing',
      'status/growing_croft',
      'status/hearty',
      'status/hen_fed',
      'status/spoiling',
      'status/withered',
    ],
    facts: [
      'fact/cooked',
      'fact/gifted_apple',
      'fact/gifted_rat',
      'fact/ordered',
      'fact/owns_pen',
      'fact/owns_plot',
      'fact/regard',
      'fact/sown_at',
      'fact/traded_knife',
      'fact/watered_at',
    ],
  };
  for (const [table, refs] of Object.entries(drop))
    for (const r of refs) delete c[table][`toolbox_showcase@0.0.1:${r}`];
  for (const s of Object.values(c.skills) as any[])
    for (const k of ['profession', 'prerequisite', 'hidden']) delete s[k];
  // The Undercroft's banks, timed escrow, stock tables, shelves and locks.
  for (const k of ['clerk_a', 'clerk_b', 'smith']) delete c.npcs[ref('npc', k)].services;
  for (const k of ['chandler', 'yard_chandler']) delete c.npcs[ref('npc', k)].shop;
  for (const k of ['hoard_chest', 'strongroom_chest', 'strongroom_key', 'yard_crate'])
    delete c.items[ref('item', k)].locks;
  delete c.rooms[ref('room', 'strongroom')].locks;
  for (const k of ['shelf', 'yard_shelf']) delete c.replenish[ref('replenish', k)];
  for (const k of [
    'buy_strongroom',
    'deposit_a',
    'deposit_b',
    'forge_cancel',
    'forge_claim',
    'forge_commission',
    'withdraw_a',
    'withdraw_b',
  ])
    delete c.services[ref('service', k)];
  // The law district: theft, hide, NPC locks, stolen offers, the fine, the jail talk and the
  // guard's arrest (1.105; hostile alone is refused).
  delete c.world.theft;
  for (const k of ['fence', 'vault']) delete c.npcs[ref('npc', k)].locks;
  delete c.npcs[ref('npc', 'fence')].shop;
  delete c.statuses[ref('status', 'hidden')];
  for (const k of ['hide', 'yard_hide']) delete c.reactions[ref('reaction', k)];
  for (const k of ['clerk_fine', 'jailer_broke', 'jailer_talk'])
    delete c.dialogues[ref('dialogue', k)];
  delete c.reactions[ref('reaction', 'charge')];
  delete c.npcs[ref('npc', 'guard')].disposition;
  // The magic district: the light capability (above 1.58), its lanterns, the dark crypt and the
  // spells (1.98) with flamma's sparks; ward's level and stat policy.
  delete c.manifest.requires.capabilities.light;
  delete c.lock.capabilities.light;
  for (const k of ['lux', 'ward', 'flamma']) delete c.recipes[ref('recipe', k)];
  delete c.reactions[ref('reaction', 'flamma_sparks')];
  for (const k of ['lantern', 'attic_lantern', 'lamp_oil']) delete c.items[ref('item', k)];
  delete c.rooms[ref('room', 'crypt')].dark_description;
}
