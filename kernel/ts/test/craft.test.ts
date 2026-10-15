// Homestead hs-10 (docs/system/mechanics.md Craft) on the compiled craft sampler: the workshop's
// bench carries carve_spoon (opposed whittling, rating 1, growth [1]); it consumes one of
// stick_01..02 into the sealed scrap room and yields one of spoon_01..02 from the sealed store.
// The sticks and a waist sack lie in the workshop; the first try fails (whittling 0), the second
// succeeds (whittling 1). Homestead hs-11: whittling grows [1, 2]; the old carver in the workshop
// teaches carving, whose prerequisite is whittling 2.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';
import { hydrate } from '../src/runtime/created.ts';
import { check } from '../src/runtime/invariants.ts';
import { resolved } from '../src/commands/actions.ts';
import { pending } from '../src/mechanics/dialogue/shared.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'loka-craft-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/craft_sampler', file], {
    cwd: root,
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;

let n = 0;
const play = (w: World, payload: object, i = ++n) =>
  step(
    w,
    {
      id: `eeeeeeee-5555-4444-8444-${String(i).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    i,
  );
const ok = (w: World, payload: object) => {
  const r = play(w, payload);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
const P = 'craft_sampler@0.0.1:';
const item = (w: World, k: string) => w.entityIds[`${P}item/${k}`]!;
const room = (w: World, k: string) => w.roomIds[`${P}room/${k}`]!;
const at = (w: World, k: string) => w.state.containers[item(w, k)];
const fresh = (c = content) =>
  newWorld(c, '6a1f3c2e-9b4d-4e7a-8c5f-2d0b1e3a4c6f' as never, [1, 2, 3, 4]);
const take = (w: World, k: string) => ok(w, { type: 'take', item_id: item(w, k) });
const holding = () => take(take(fresh(), 'stick_01'), 'stick_02');
const carve = (w: World, i?: number) => play(w, { type: 'perform', action: 'carve_spoon' }, i);
// Item ids lowest first: the order a craft selects in (selected, containment/stock.ts).
const ordered = (w: World, ...keys: string[]) => keys.map((k) => item(w, k)).sort();
const code = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'rejected' ? r.decision.error.code : r.decision.kind;
const uses = (w: World) =>
  Object.entries(w.state.facts ?? {}).find(([k]) => k.includes('"uses_whittling"'))?.[1] ?? 0;
const offer = (w: World) => {
  let found:
    { available: boolean; reason?: { code: string; message?: { key: string } } } | undefined;
  JSON.stringify(gameView(w), (_, v) => (v?.action_key === 'carve_spoon' ? (found = v) : v));
  assert.ok(found, 'carve_spoon offered');
  return found;
};
// The offer and step agree on this world's carve (the invariant the GameView must keep).
const agrees = (w: World, r: ReturnType<typeof step>) => {
  const resolves = Object.fromEntries(
    Object.values(resolved(w, w.character)).map((a) => [a.key, a.command]),
  );
  const command = { payload: { type: 'perform', action: 'carve_spoon' } };
  return check('gameview_agrees_with_admission', {
    view: gameView(w),
    command,
    decision: r.decision,
    resolves,
  });
};
type Accepted = Extract<ReturnType<typeof step>['decision'], { kind: 'accepted' }>;

// Breaks: a failed craft keeps the stick or hands out a spoon; a craft takes a stick other than
// the lowest-id held one, leaves the spoon in the store, or emits no item_acquired after the check.
test('a failed carve spends a stick and makes nothing; the next carve makes a spoon', () => {
  let r = carve(holding());
  assert.equal(code(r), 'accepted');
  let w = r.world;
  const [stick1, stick2] = ordered(w, 'stick_01', 'stick_02');
  const [spoon1, spoon2] = ordered(w, 'spoon_01', 'spoon_02');
  const where = (x: World) => [stick1, stick2, spoon1, spoon2].map((id) => x.state.containers[id]);
  assert.equal((r.decision as Accepted).outcome, 'failure');
  assert.deepEqual(where(w), [room(w, 'scrap'), w.body, room(w, 'store'), room(w, 'store')]);
  assert.equal(uses(w), 1);
  r = carve(w);
  w = r.world;
  const d = r.decision as Accepted;
  assert.equal(d.outcome, 'success');
  assert.deepEqual(where(w), [room(w, 'scrap'), room(w, 'scrap'), w.body, room(w, 'store')]);
  const types = d.events.map((e) => e.payload.type);
  const acquired = d.events.filter((e) => e.payload.type === 'item_acquired');
  assert.deepEqual(
    acquired.map((e) => e.payload),
    [{ type: 'item_acquired', item_id: spoon1, holder_id: w.body }],
  );
  assert.ok(types.indexOf('item_acquired') > types.indexOf('check_passed'), types.join());
});

// Breaks: admission or the offer ignores the craft (an empty-handed carve is accepted, or the
// offer shows available while step refuses), step checks a cooldown before the shortage the offer
// shows, the shortage loses its reason line, or an empty store keeps the reason line it does not own.
test('no stick, or no spoon left, refuses with the same code offered', () => {
  let w = ok(ok(holding(), { type: 'perform', action: 'carve_spoon' }), {
    type: 'perform',
    action: 'carve_spoon',
  });
  let r = carve(w);
  assert.equal(code(r), 'invalid_state');
  assert.equal(offer(w).available, false);
  assert.equal(offer(w).reason?.message?.key, 'craft.carve_spoon.needs');
  assert.ok(agrees(w, r));
  // With a cooldown running too, step refuses the shortage the offer shows (commands/actions.ts).
  const k = `${P}recipe/carve_spoon`;
  const recipes = { ...content.recipes, [k]: { ...content.recipes![k]!, cooldown: 1000 } };
  const cooled = carve(take(fresh({ ...content, recipes }), 'stick_01')).world;
  r = carve(cooled);
  assert.equal(code(r), 'invalid_state');
  assert.ok(agrees(cooled, r));
  // Sticks put back in hand, store emptied: the yield refuses with no message.
  w = {
    ...w,
    state: {
      ...w.state,
      containers: {
        ...w.state.containers,
        [item(w, 'stick_01')]: w.body,
        [item(w, 'stick_02')]: w.body,
        [item(w, 'spoon_01')]: room(w, 'workshop'),
        [item(w, 'spoon_02')]: room(w, 'workshop'),
      },
    },
  };
  r = carve(w);
  assert.equal(code(r), 'invalid_state');
  assert.deepEqual([offer(w).available, offer(w).reason?.message], [false, undefined]);
  assert.ok(agrees(w, r));
});

// Breaks: a stick inside a worn sack counts as held (the consume selects nested items).
test('a stick in a worn sack is not counted', () => {
  let w = take(take(fresh(), 'stick_01'), 'sack');
  w = ok(w, { type: 'put', item_id: item(w, 'stick_01'), container_id: item(w, 'sack') });
  w = ok(w, { type: 'wear', item_id: item(w, 'sack') });
  const r = carve(w);
  assert.equal(code(r), 'invalid_state');
  assert.equal(at(r.world, 'stick_01'), item(w, 'sack'));
  assert.ok(agrees(w, r));
});

// Breaks: the craft draws on something reopen does not restore (ids or custody differ).
test('reopening between the two carves gives the same ids', () => {
  const w = carve(holding()).world;
  const reopened = hydrate(fresh(), JSON.parse(JSON.stringify(w.state)), true)!;
  const i = ++n;
  const [a, b] = [carve(w, i), carve(reopened, i)];
  assert.deepEqual(JSON.parse(JSON.stringify(b.decision)), JSON.parse(JSON.stringify(a.decision)));
  assert.equal(b.world.state.containers[ordered(w, 'spoon_01', 'spoon_02')[0]!], b.world.body);
});

// Breaks: the loader admits a template or non-container holder, an unresolved item, holder or
// reason, a duplicate item, or a craft on a storylet or spell (twin of test/loka/content_craft_test.exs;
// the floor is loader_floors.json's "a craft" case).
const loadEdited = (edit: (c: any) => void) => {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
};

test('loader: a craft needs resolved, placed holders, distinct items, a catalog reason, a station', () => {
  const R = (kind: string, key: string) => ({
    cartridge_id: 'craft_sampler',
    cartridge_version: '0.0.1',
    kind,
    key,
  });
  const at = `.cartridge.recipes["${P}recipe/carve_spoon"].craft`;
  const load = (edit: (r: any, c: any) => void) =>
    loadEdited((c) => edit(c.recipes[`${P}recipe/carve_spoon`], c));
  const cases: [(r: any, c: any) => void, string, string][] = [
    [(r) => (r.craft.consume.to = { in: 'template' }), 'SCHEMA_VIOLATION', '.consume.to'],
    [
      (r) => (r.craft.yield.from = { in: 'item', item: R('item', 'stick_02') }),
      'SCHEMA_VIOLATION',
      '.yield.from',
    ],
    [
      (r) => (r.craft.consume.items = [R('item', 'nothing')]),
      'UNRESOLVED_REFERENCE',
      '.consume.items[0]',
    ],
    [
      (r) => (r.craft.yield.from = { in: 'room', room: R('room', 'nowhere') }),
      'UNRESOLVED_REFERENCE',
      '.yield.from.room',
    ],
    [
      (r) => (r.craft.yield.items = [R('item', 'spoon_01'), R('item', 'spoon_01')]),
      'DUPLICATE_DEFINITION',
      '.yield.items',
    ],
    [(r) => (r.craft.consume.reason = 'craft.unknown'), 'UNRESOLVED_REFERENCE', '.consume.reason'],
    [
      (r) => {
        delete r.check; // a storylet takes no check; the craft is what this case refuses
        r.target = { kind: 'storylet', rooms: [R('room', 'workshop')] };
      },
      'SCHEMA_VIOLATION',
      '',
    ],
    [
      (r, c) => {
        const known = { ...c.facts[`${P}fact/spoon_carved`], key: 'known', scopes: ['player'] };
        c.facts[`${P}fact/known`] = known; // a valid learned fact, so only the craft refuses
        delete r.check;
        r.target = { kind: 'spell', word: 'carve', learned: R('fact', 'known') };
      },
      'SCHEMA_VIOLATION',
      '',
    ],
  ];
  assert.equal(
    load(() => {}),
    'loaded',
  );
  for (const [edit, code, path] of cases) assert.deepEqual(load(edit), [code, at + path]);
});

// Breaks (hs-11; twin of content_craft_test.exs): a skill prerequisite naming its own skill, or an
// unknown skill, loads. The floor is loader_floors.json's "a skill prerequisite" case.
test('loader: a skill prerequisite resolves and never names its own skill', () => {
  const at = `.cartridge.skills["${P}skill/carving"].prerequisite`;
  // The leaf sits under all and not, so a walker that skips nesting misses it.
  const naming = (key: string) => (c: any) => {
    const p = c.skills[`${P}skill/carving`].prerequisite;
    const leaf = { ...p.root, skill: { ...p.root.skill, key } };
    p.root = { op: 'all', items: [{ op: 'not', item: leaf }] };
  };
  const leaf = at + '.root.items[0].item.skill';
  assert.deepEqual(loadEdited(naming('carving')), ['SCHEMA_VIOLATION', at]);
  assert.deepEqual(loadEdited(naming('nothing')), ['UNRESOLVED_REFERENCE', leaf]);
});

// A stick held, a carry limit of 100 g and 200 g spoons: the carve's exchange is too heavy.
const heavy = (c = content) => {
  const w = take(fresh({ ...c, world: { ...c.world, carry: { max_grams: 100 } } }), 'stick_01');
  const spoon = (k: string) => ({ [item(w, k)]: { ...w.entities[item(w, k)]!, mass_grams: 200 } });
  return { ...w, entities: { ...w.entities, ...spoon('spoon_01'), ...spoon('spoon_02') } };
};

// Breaks: the craft skips the carry check on the exchange (a heavier spoon for a stick exceeds the
// limit) or hands over a stick the give rule protects.
test('a craft the body cannot carry, or a protected stick, refuses with the same code offered', () => {
  let w = heavy();
  let r = carve(w);
  assert.equal(code(r), 'too_heavy');
  assert.ok(agrees(w, r));
  w = take(fresh(), 'stick_01');
  const stick = item(w, 'stick_01');
  w = {
    ...w,
    entities: { ...w.entities, [stick]: { ...w.entities[stick]!, give_allowed: false } as never },
  };
  r = carve(w);
  assert.equal(code(r), 'invalid_state');
  assert.ok(agrees(w, r));
});

// Breaks: the craft drops a stick into a scrap room already at its capacity (a full put refuses).
test('a craft whose scrap room is full refuses with the same code offered', () => {
  const w0 = holding();
  const w = { ...w0, capacities: { ...w0.capacities, [room(w0, 'scrap')]: 0 } };
  const r = carve(w);
  assert.equal(code(r), 'invalid_state');
  assert.ok(agrees(w, r));
});

// Breaks: the press reads the craft before the recipe's policy, so it refuses too_heavy while
// the offer (view/action_lists.ts) refuses on the policy.
test('a craft whose policy fails refuses on the policy, as offered', () => {
  const key = `${P}recipe/carve_spoon`;
  const shut = {
    ...content.recipes![key]!,
    policy: { policy_version: 1, root: { op: 'any', items: [] } },
  };
  const w = heavy({ ...content, recipes: { ...content.recipes, [key]: shut } } as never);
  const r = carve(w);
  assert.equal(code(r), 'invalid_state'); // not the craft's too_heavy
  assert.ok(agrees(w, r));
});

// Homestead hs-11. Breaks: the dialogue admission (dialogue/shared.ts blocked) skips the
// prerequisite (the level-1 choose is accepted), the offer disagrees with admission (agrees
// fails), or the conversation offers the lesson again after it is learned.
test('carving is learned only at whittling 2, offered and admitted alike', () => {
  const carver = (w: World) => w.entityIds[`${P}npc/old_carver`]!;
  const learned = (w: World) =>
    Object.entries(w.state.facts ?? {}).find(([k]) => k.includes('"skill_carving"'))?.[1] ?? false;
  const learn = (w0: World) => {
    const w = ok(w0, { type: 'talk', target_id: carver(w0) });
    const [continuation_id] = pending(w, w.character)!;
    const command = { payload: { type: 'choose', choice_id: 'learn', continuation_id } };
    const offered = gameView(w).choice!.choices.find((c) => c.choice_id === 'learn')!;
    const r = play(w, command.payload);
    assert.ok(
      check('gameview_agrees_with_admission', { view: gameView(w), command, decision: r.decision }),
    );
    return { w, r, offered };
  };
  const level1 = carve(holding()).world; // failed: one use, whittling 1
  const refused = learn(level1);
  assert.equal(refused.offered.available, false);
  assert.equal(code(refused.r), 'invalid_state');
  assert.equal(refused.r.world, refused.w); // nothing changed
  assert.equal(learned(refused.w), false);
  const level2 = carve(level1).world; // two uses: whittling 2
  const taught = learn(level2);
  assert.equal(taught.offered.available, true);
  assert.equal(code(taught.r), 'accepted');
  assert.equal(learned(taught.r.world), true);
  const w = taught.r.world; // the conversation ends with the lesson
  assert.equal(code(play(w, { type: 'talk', target_id: carver(w) })), 'invalid_state');
});
