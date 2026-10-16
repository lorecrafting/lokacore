// size: allow 750, the craft sampler walks (hs-10 to hs-12) and the hs-14 skill tree share one compiled cartridge and helpers
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
import { validate } from '../src/foundation/validate.ts';
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
// hs-12: the one ancestry (woodfolk) grants woodcutting at birth, so play starts by choosing it.
const fresh = (c = content) =>
  ok(newWorld(c, '6a1f3c2e-9b4d-4e7a-8c5f-2d0b1e3a4c6f' as never, [1, 2, 3, 4]), {
    type: 'choose_ancestry',
    ancestry: 'woodfolk',
  });
const take = (w: World, k: string) => ok(w, { type: 'take', item_id: item(w, k) });
const holding = () => take(take(fresh(), 'stick_01'), 'stick_02');
const carve = (w: World, i?: number) => play(w, { type: 'perform', action: 'carve_spoon' }, i);
// Item ids lowest first: the order a craft selects in (selected, containment/stock.ts).
const ordered = (w: World, ...keys: string[]) => keys.map((k) => item(w, k)).sort();
const code = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'rejected' ? r.decision.error.code : r.decision.kind;
const uses = (w: World, skill = 'whittling') =>
  Object.entries(w.state.facts ?? {}).find(([k]) => k.includes(`"uses_${skill}"`))?.[1] ?? 0;
const offer = (w: World, action = 'carve_spoon') => {
  let found:
    { available: boolean; reason?: { code: string; message?: { key: string } } } | undefined;
  JSON.stringify(gameView(w), (_, v) => (v?.action_key === action ? (found = v) : v));
  assert.ok(found, `${action} offered`);
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
const reload = (edit: (c: any) => void) => {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
};
const loadEdited = (edit: (c: any) => void) => {
  const r = reload(edit);
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

const carver = (w: World) => w.entityIds[`${P}npc/old_carver`]!;
const opened = (w: World) => ok(w, { type: 'talk', target_id: carver(w) });
const ids = (w: World) => gameView(w).choice!.choices.map((c) => c.choice_id);
const box = (w: World, key: string) => gameView(w).skills!.find((s) => s.skill.key === key)!;

// Homestead hs-11. Breaks: the dialogue admission (dialogue/shared.ts blocked) skips the
// prerequisite (the level-1 choose is accepted), the offer disagrees with admission (agrees
// fails), or the conversation offers the lesson again after it is learned.
test('carving is learned only at whittling 2, offered and admitted alike', () => {
  const learned = (w: World) =>
    Object.entries(w.state.facts ?? {}).find(([k]) => k.includes('"skill_carving"'))?.[1] ?? false;
  const learn = (w0: World) => {
    const w = opened(w0);
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
  assert.equal(box(refused.w, 'carving').locked, true); // hs-14: the view says why
  assert.equal(code(refused.r), 'invalid_state');
  assert.equal(refused.r.world, refused.w); // nothing changed
  assert.equal(learned(refused.w), false);
  const level2 = carve(level1).world; // two uses: whittling 2
  const taught = learn(level2);
  assert.equal(taught.offered.available, true);
  assert.equal(box(taught.w, 'carving').locked, false);
  assert.equal(code(taught.r), 'accepted');
  assert.equal(learned(taught.r.world), true);
  const w = taught.r.world; // the conversation ends with the lesson
  assert.equal(code(play(w, { type: 'talk', target_id: carver(w) })), 'invalid_state');
});

// Homestead hs-14 (book-ui.md Skill tree details). Breaks: level is projected without growth or
// stops at the wrong growth threshold, locked is projected without a prerequisite or flips at
// the wrong whittling level, or profession is dropped. Whittling grows [1, 2]; carving needs
// whittling 2; joinery (no growth) needs carving 1.
test('the skill tree view: level with growth, locked with a prerequisite, at the boundaries', () => {
  const tree = (w: World) =>
    gameView(w).skills!.map(({ skill, level, locked, profession }) => ({
      key: skill.key,
      ...(level !== undefined && { level }),
      ...(locked !== undefined && { locked }),
      profession,
    }));
  const row = (key: string, more: object, profession?: string) => ({ key, ...more, profession });
  const at = (w: World, whittling: number, carvingLocked: boolean) =>
    assert.deepEqual(tree(w), [
      row('carpentry', { level: 0, locked: true }), // hs-12: needs woodcutting 2
      row('carving', { level: 0, locked: carvingLocked }, 'profession.handcraft'),
      row('joinery', { locked: true }, 'profession.woodcraft'),
      row('whittling', { level: whittling }, 'profession.woodcraft'),
      row('woodcutting', { level: 1 }), // hs-12: woodfolk grants it at birth
    ]);
  const level1 = carve(holding()).world;
  at(fresh(), 0, true);
  at(level1, 1, true);
  at(carve(level1).world, 2, false);
});

// Breaks (hs-14): a hidden skill is projected while its prerequisite fails, or stays out once
// it holds.
test('a hidden skill is left out of the view while its prerequisite fails', () => {
  const hide = (k: string) => ({
    [`${P}skill/${k}`]: { ...content.skills![`${P}skill/${k}`]!, hidden: true },
  });
  const c = { ...content, skills: { ...content.skills, ...hide('carving'), ...hide('joinery') } };
  const keys = (w: World) => gameView(w).skills!.map((s) => s.skill.key);
  const level1 = carve(take(take(fresh(c as never), 'stick_01'), 'stick_02')).world;
  assert.deepEqual(keys(level1), ['carpentry', 'whittling', 'woodcutting']);
  assert.deepEqual(keys(carve(level1).world), ['carpentry', 'carving', 'whittling', 'woodcutting']);
});

// Breaks (hs-14 review): a learned hidden skill vanishes when its prerequisite stops holding, or an
// NPC lists a lesson for a skill the view leaves out. Carving is hidden and needs stick_02 held.
test('a learned hidden skill stays in the view; a lesson for a left-out skill is not listed', () => {
  const carving = content.skills![`${P}skill/carving`]!;
  const stick = { ...(carving.prerequisite!.root as any).skill, kind: 'item', key: 'stick_02' };
  const root = { op: 'has_item', item: stick } as never;
  const c = {
    ...content,
    skills: {
      ...content.skills,
      [`${P}skill/carving`]: {
        ...carving,
        hidden: true,
        prerequisite: { policy_version: 1, root },
      },
      [`${P}skill/joinery`]: { ...content.skills![`${P}skill/joinery`]!, hidden: true },
    },
  };
  const seen = (w: World) => ({
    keys: gameView(w).skills!.map((s) => s.skill.key),
    lessons: gameView(w)
      .entities.find((e) => e.id === carver(w))!
      .lessons?.map((r) => r.key),
  });
  const w0 = fresh(c as never);
  // hs-12's carpentry is shown, so the carver lists its lesson
  const shown = (keys: string[], lessons: string[]) => ({
    keys: ['carpentry', ...keys, 'woodcutting'],
    lessons: ['carpentry', ...lessons],
  });
  assert.deepEqual(seen(w0), shown(['whittling'], []));
  const held = take(take(w0, 'stick_01'), 'stick_02');
  assert.deepEqual(seen(held), shown(['carving', 'whittling'], ['carving']));
  const talking = ok(held, { type: 'talk', target_id: carver(held) });
  const [continuation_id] = pending(talking, talking.character)!;
  const learned = ok(talking, { type: 'choose', choice_id: 'learn', continuation_id });
  const dropped = ok(learned, { type: 'drop', item_id: item(learned, 'stick_02') });
  assert.equal(box(dropped, 'carving').locked, true);
  assert.equal(box(dropped, 'carving').acquired, true);
  // joinery needs carving 1, which learning gives
  assert.deepEqual(seen(dropped), shown(['carving', 'joinery', 'whittling'], ['carving']));
});

// Carving (needs whittling 2) and joinery hidden; `leave` adds a choice to carving's dialogue.
const secret = (leave = false) => {
  const hide = (k: string) => ({
    [`${P}skill/${k}`]: { ...content.skills![`${P}skill/${k}`]!, hidden: true },
  });
  const key = `${P}dialogue/old_carver_carving`;
  const d = content.dialogues![key]!;
  const choices = { ...d.choices, ...(leave && { leave: { label: 'old_carver.carving.prompt' } }) };
  const c = {
    ...content,
    skills: { ...content.skills, ...hide('carving'), ...hide('joinery') },
    dialogues: { ...content.dialogues, [key]: { ...d, choices } },
  };
  return carve(take(take(fresh(c as never), 'stick_01'), 'stick_02')).world; // whittling 1
};

// Breaks (hs-14 secret): the carver's talk opens with no choice (choices: [], a GameView the schema
// refuses) or is offered while every lesson is concealed, or the lesson stays concealed at
// whittling 2. Carpentry's dialogue needs woodcutting 2 (woodcutting 1 here), so it never opens.
test('a talk whose every lesson is concealed is refused and not offered', () => {
  const level1 = secret();
  const r = play(level1, { type: 'talk', target_id: carver(level1) });
  assert.deepEqual(validate('GameView', gameView(r.world)), []);
  assert.equal(gameView(r.world).choice, undefined);
  assert.equal(code(r), 'invalid_state');
  const talk = offer(level1, 'old_carver_carving')!;
  assert.deepEqual([talk.available, talk.reason], [false, { code: 'invalid_state' }]);
  assert.deepEqual(gameView(opened(carve(level1).world)).choice!.choices, [
    { available: true, choice_id: 'learn', label: 'old_carver.carving.choice' },
  ]);
});

// Breaks (hs-14 secret): the opened row lists the concealed lesson (choose admits it), or leaves it
// out once whittling 2 holds.
test('a concealed lesson is left out of the opened choices and refused', () => {
  const level1 = opened(secret(true));
  assert.deepEqual(ids(level1), ['leave']);
  const [continuation_id] = pending(level1, level1.character)!;
  const r = play(level1, { type: 'choose', choice_id: 'learn', continuation_id });
  assert.equal(code(r), 'invalid_state');
  assert.deepEqual(ids(opened(carve(secret(true)).world)), ['learn', 'leave']); // whittling 2
});

// Breaks (hs-14 secret; twin of content_craft_test.exs): a shown skill's qualification or a
// dialogue policy reading a hidden skill loads, a labeled talk or a riddle dialogue (its letter
// bank shows) teaching one loads, or a hidden skill's own qualification reading one is refused.
test('loader: no shown qualification, dialogue policy, talk label or riddle reveals a hidden skill', () => {
  const S = (k: string) => `${P}skill/${k}`;
  const D = (k: string) => `${P}dialogue/${k}`;
  const hide = (c: any) => ['carving', 'joinery'].forEach((k) => (c.skills[S(k)].hidden = true));
  const reading = (policy: (c: any) => any) => (c: any) => {
    const skill = { ...c.skills[S('carving')].prerequisite.root.skill, key: 'carving' };
    hide(c);
    policy(c).root = { op: 'all', items: [{ op: 'skill_compare', skill, at_least: 1 }] };
  };
  const at = (path: string) => ['SCHEMA_VIOLATION', `.cartridge.${path}`];
  const whittling = reading((c) => c.skills[S('whittling')].qualification);
  assert.deepEqual(loadEdited(whittling), at(`skills["${S('whittling')}"].qualification`));
  const carpentry = reading((c) => c.dialogues[D('old_carver_carpentry')].policy);
  assert.deepEqual(loadEdited(carpentry), at(`dialogues["${D('old_carver_carpentry')}"].policy`));
  assert.equal(loadEdited(reading((c) => c.skills[S('joinery')].qualification)), 'loaded');
  const wrong = 'old_carver.carving.prompt';
  for (const [field, value] of Object.entries({
    label: wrong,
    riddle: { choice_id: 'learn', answer: 'a', bank: ['A'], wrong },
  })) {
    const set = (c: any) => (c.dialogues[D('old_carver_carving')][field] = value);
    const hidden = (c: any) => (hide(c), set(c));
    assert.deepEqual(loadEdited(hidden), at(`dialogues["${D('old_carver_carving')}"].${field}`));
    assert.equal(loadEdited(set), 'loaded'); // carving shown
  }
});

// Breaks (hs-14; twin of content_craft_test.exs): a shown skill whose prerequisite reads a hidden
// skill loads, a hidden skill reading a hidden one is refused, or an unknown profession text
// loads. The floor is loader_floors.json's "a skill profession" case.
test('loader: a shown prerequisite never reads a hidden skill; a profession resolves', () => {
  const S = (k: string) => `${P}skill/${k}`;
  const hide =
    (...keys: string[]) =>
    (c: any) =>
      keys.forEach((k) => (c.skills[S(k)].hidden = true));
  assert.deepEqual(loadEdited(hide('carving')), [
    'SCHEMA_VIOLATION',
    `.cartridge.skills["${S('joinery')}"].prerequisite`,
  ]);
  assert.equal(loadEdited(hide('carving', 'joinery')), 'loaded');
  assert.deepEqual(
    loadEdited((c) => (c.skills[S('whittling')].profession = 'profession.nothing')),
    ['UNRESOLVED_REFERENCE', `.cartridge.skills["${S('whittling')}"].profession`],
  );
});

// Homestead hs-12 (Built rooms S6): the axe lies in the workshop; chop at the glade's oak yields a
// log from the sealed woodpile (woodcutting, growth [2]); the old carver teaches carpentry at
// woodcutting 2; saw at the sawhorse turns two logs into a timber (carpentry, growth [2]); raise at
// the lane's plot stakes spends two timbers into the yard and builds hut_timbered north.
const move = (w: World, ...dirs: string[]) =>
  dirs.reduce((x, direction) => ok(x, { type: 'move', direction }), w);
const perform = (w: World, action: string, i?: number) => play(w, { type: 'perform', action }, i);
const done = (w: World, ...actions: string[]) =>
  actions.reduce((x, action) => ok(x, { type: 'perform', action }), w);
const lessons = (w: World) => ids(opened(w));
const carpentry = (w0: World) => {
  const w = opened(w0);
  const [continuation_id] = pending(w, w.character)!;
  return ok(w, { type: 'choose', choice_id: 'learn_carpentry', continuation_id });
};
const chopped = (w: World) => move(done(move(w, 'west'), 'chop', 'chop'), 'east');
// Two timbers held at the lane, carpentry 2: one step short of the raise.
const ready = (c = content) =>
  move(done(chopped(done(carpentry(chopped(take(fresh(c), 'axe'))), 'saw')), 'saw'), 'east');
const built = (w: World) =>
  Object.keys(w.state.created ?? {}).filter((id) => w.state.created![id].origin.kind === 'built');
const R = (kind: string, key: string) =>
  ({ cartridge_id: 'craft_sampler', cartridge_version: '0.0.1', kind, key }) as never;
const hire = (w: World, quoted_price = 5) =>
  play(w, {
    type: 'use_service',
    provider_id: w.entityIds[`${P}npc/carpenter`],
    service: R('service', 'raise_hut_plain'),
    quoted_price,
  });
const refusal = (key: string) => ({ code: 'invalid_state', message: { key } });

// Breaks: chop yields no log or takes no time, woodcutting does not grow, carpentry is taught
// before woodcutting 2, saw returns no logs or makes no timber, the build step raises no room, at
// the wrong site or for another owner, the hut has no way in, or the carpenter can still build.
test('chop, learn carpentry, saw and raise the timbered hut north of the lane', () => {
  let w = move(take(fresh(), 'axe'), 'west');
  const c0 = w.state.clock;
  w = done(w, 'chop');
  assert.deepEqual(lessons(move(w, 'east')), ['learn']); // woodcutting 1: carving's lesson only
  w = done(w, 'chop');
  const logs = ordered(w, 'log_01', 'log_02', 'log_03', 'log_04');
  const where = (x: World, ids: string[]) => ids.map((id) => x.state.containers[id]);
  assert.deepEqual(where(w, logs), [w.body, w.body, room(w, 'woodpile'), room(w, 'woodpile')]);
  assert.equal(w.state.clock, c0 + 1200);
  assert.equal(uses(w, 'woodcutting'), 2);
  w = move(w, 'east');
  assert.deepEqual(lessons(w), ['learn_carpentry']);
  w = done(carpentry(w), 'saw');
  const timbers = ordered(w, 'timber_01', 'timber_02');
  assert.deepEqual(where(w, timbers), [w.body, room(w, 'woodpile')]);
  assert.deepEqual(where(w, logs), Array(4).fill(room(w, 'woodpile')));
  w = done(chopped(w), 'saw');
  assert.deepEqual(where(w, timbers), [w.body, w.body]);
  assert.equal(uses(w, 'carpentry'), 2);
  w = done(move(w, 'east'), 'raise_timbered_hut');
  const [hut] = built(w);
  assert.deepEqual(JSON.parse(JSON.stringify(w.state.created![hut!].origin)), {
    kind: 'built',
    site: R('room', 'lane'),
    direction: 'north',
    owner: w.character,
  });
  assert.deepEqual(where(w, timbers), [room(w, 'yard'), room(w, 'yard')]);
  w = move(w, 'north');
  assert.equal(w.state.containers[w.body], hut);
  assert.equal(gameView(w).place.title.key, 'blueprint.hut_timbered.title');
  w = move(w, 'south');
  assert.deepEqual(hire(w).decision, { kind: 'rejected', error: { code: 'invalid_state' } });
  assert.deepEqual(offer(w, 'raise_hut_plain').reason, refusal('service.site_taken'));
  // the site's refusal before the spent timbers' craft.raise.needs, as the build service's
  assert.deepEqual(offer(w, 'raise_timbered_hut').reason, refusal('service.site_taken'));
});

// Breaks: admission skips the build refusal (a forged raise on a taken site is accepted), or the
// carpenter's price is not charged or charged short (4 pennies buys the hut).
test('the carpenter first: the plain hut for 5 pennies, then the raise is refused', () => {
  const pennies = (c: Cartridge, start: number) => {
    const k = Object.keys(c.resources!).find((x) => x.endsWith('/pennies'))!;
    return { ...c, resources: { ...c.resources, [k]: { ...c.resources![k]!, start } } } as never;
  };
  const poor = ready(pennies(content, 4));
  assert.equal(code(hire(poor)), 'insufficient_resource'); // 4 pennies: one below the price
  const w0 = ready(pennies(content, 5));
  const w = hire(w0).world;
  assert.equal(code(hire(w0)), 'accepted');
  const [hut] = built(w);
  assert.equal(gameView(move(w, 'north')).place.title.key, 'blueprint.hut_plain.title');
  assert.deepEqual(offer(w, 'raise_timbered_hut').reason, refusal('service.site_taken'));
  const r = perform(w, 'raise_timbered_hut');
  assert.equal(code(r), 'invalid_state');
  assert.equal(r.world, w);
  assert.deepEqual([at(w, 'timber_01'), at(w, 'timber_02')], [w.body, w.body]);
});

// Breaks: the minted room id depends on more than the command (replay mints another), or reopen
// loses the built room, its title or the lane's way north.
test('the raised hut keeps its id and exits on reopen, and replay mints the same id', () => {
  n = 0;
  const w = done(ready(), 'raise_timbered_hut');
  const [hut] = built(w);
  const plain = (x: World) => JSON.parse(JSON.stringify([x.roomIds, x.rooms]));
  assert.deepEqual(plain(hydrate(fresh(), JSON.parse(JSON.stringify(w.state)), true)!), plain(w));
  n = 0;
  assert.deepEqual(built(done(ready(), 'raise_timbered_hut')), [hut]);
});

// Breaks: a failed raise still builds (the step not skipped on failure) or keeps its timbers
// (owner answer: a failed craft loses its inputs).
test('a failed raise spends both timbers and builds nothing', () => {
  const c = structuredClone(content) as any;
  c.rooms[`${P}room/lane`].details.plot_stakes.rating = 9;
  const r = perform(ready(c), 'raise_timbered_hut');
  assert.equal((r.decision as Accepted).outcome, 'failure');
  assert.deepEqual(built(r.world), []);
  assert.deepEqual(
    [at(r.world, 'timber_01'), at(r.world, 'timber_02')],
    [room(r.world, 'yard'), room(r.world, 'yard')],
  );
});

// Breaks: chop admitted without woodcutting (skill_compare 1), or the build step's caps
// off by one: a second hut_timbered past max_per_owner 1, or a third structure past max_total 2.
test('chop needs woodcutting 1; a raise counts max_per_owner 1 and max_total 2', () => {
  const whittler = structuredClone(content) as any; // the ancestry grants whittling instead
  whittler.ancestries.woodfolk.skill = R('skill', 'whittling');
  assert.equal(code(perform(move(take(fresh(whittler), 'axe'), 'west'), 'chop')), 'invalid_state');
  // The lane gains east and south; raise_east and raise_south build hut_timbered there for free.
  const wider = (owner_cap: boolean) => {
    const r = reload((c) => {
      c.rooms[`${P}room/lane`].site.directions.push('east', 'south');
      const raise = c.recipes[`${P}recipe/raise_timbered_hut`];
      for (const direction of ['east', 'south']) {
        const { craft: _, ...free } = structuredClone(raise);
        free.key = `raise_${direction}`;
        free.aliases = [free.key];
        free.check.key = free.key;
        free.outcomes.success.sequence[0].direction = direction;
        c.recipes[`${P}recipe/raise_${direction}`] = free;
      }
      if (!owner_cap) delete c.blueprints[`${P}blueprint/hut_timbered`].max_per_owner;
    });
    assert.ok(r.ok, JSON.stringify(r));
    return done(ready(r.cartridge as Cartridge), 'raise_timbered_hut');
  };
  let w = wider(true);
  assert.deepEqual(offer(w, 'raise_east').reason, refusal('service.construction_full'));
  assert.equal(code(perform(w, 'raise_east')), 'invalid_state');
  w = done(wider(false), 'raise_east'); // one built: below max_total 2
  assert.equal(built(w).length, 2);
  assert.deepEqual(offer(w, 'raise_south').reason, refusal('service.construction_full'));
  assert.equal(code(perform(w, 'raise_south')), 'invalid_state');
});

// Breaks (Built rooms S6; twin of test/loka/content_craft_test.exs): a build step loads off a
// detail target, on a room that is no site, twice in one sequence, without world.construction or
// the refusal texts, or naming a blueprint or direction the site does not list.
// The floor is loader_floors.json's "a build step" case.
test('loader: a build step needs a site detail, its listed blueprint and direction, once, on success', () => {
  const at = `.cartridge.recipes["${P}recipe/raise_timbered_hut"].outcomes.`;
  const lane = `${P}room/lane`;
  const load = (edit: (r: any, c: any) => void) =>
    loadEdited((c) => edit(c.recipes[`${P}recipe/raise_timbered_hut`], c));
  const build = (r: any) => r.outcomes.success.sequence[0];
  const cases: [(r: any, c: any) => void, string, string][] = [
    [
      (r) => {
        delete r.check; // an unchecked use, so only the build step refuses
        delete r.outcomes.failure;
        r.target = { kind: 'use', tool: { tag: 'metal' } };
      },
      'SCHEMA_VIOLATION',
      'success.sequence[0].op',
    ],
    [
      (r) => (r.target = { kind: 'detail', room: R('room', 'glade'), detail: 'oak' }),
      'SCHEMA_VIOLATION',
      'success.sequence[0].op',
    ],
    [
      (r) => r.outcomes.success.sequence.push(build(r)),
      'SCHEMA_VIOLATION',
      'success.sequence[1].op',
    ],
    [(_, c) => delete c.world.construction, 'SCHEMA_VIOLATION', 'success.sequence[0].op'],
    [
      (_, c) => delete c.text['service.site_taken'],
      'UNRESOLVED_REFERENCE',
      'success.sequence[0].op',
    ],
    [
      (_, c) => delete c.text['service.construction_full'],
      'UNRESOLVED_REFERENCE',
      'success.sequence[0].op',
    ],
    [
      (_, c) => c.rooms[lane].site.blueprints.pop(),
      'SCHEMA_VIOLATION',
      'success.sequence[0].blueprint',
    ],
    [(r) => (build(r).direction = 'east'), 'SCHEMA_VIOLATION', 'success.sequence[0].direction'],
    [
      (r) => r.outcomes.failure.sequence.push(build(r)),
      'SCHEMA_VIOLATION',
      'failure.sequence[0].op',
    ],
  ];
  for (const [edit, code, path] of cases) assert.deepEqual(load(edit), [code, at + path]);
});
