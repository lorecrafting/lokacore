// NPC emotes (G9, emote@1; docs/system/mechanics.md#npc-emotes-g9) on the compiled emote sampler: the
// hall (entry), the goblins' den east of it with an immune guard, the inn north with Nell (who bows to
// whoever enters), a goblin captive in a cell north of the inn that "fetch" brings to the inn.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import { bodyOf, refString, type Cartridge, type World } from '../src/runtime/decision.ts';
import { activeStatuses } from '../src/mechanics/status/shared.ts';
import { validate } from '../src/foundation/validate.ts';
import { encode } from '../src/foundation/canonical.ts';
import { gameView } from '../src/view/view.ts';
import { spoken } from '../play/spoken.ts';
import { told } from '../src/mechanics/emote/line.ts';
import { cmd, ctx, eid } from './harness.ts';
import type { CommandId, DefinitionRef, EntityId } from '../src/contracts.gen.ts';

type Told = Parameters<typeof told>[2];

const scratch = mkdtempSync(join(tmpdir(), 'loka-emote-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/emote_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
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
const id = () => `eeeeeeee-2121-4121-8121-${String(++n).padStart(12, '0')}` as CommandId;
/** One accepted command and the English of its emote lines, as the terminal client words them. */
function play(w: World, payload: object) {
  const r = step(
    w,
    cmd({
      id: id(),
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    }),
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  const lines = r.decision.kind === 'accepted' ? (r.decision.narration ?? []) : [];
  const emoted = lines
    .filter((l) => l.key === 'emote.performed')
    .map((l) => spoken(content, l, r.world));
  return { w: r.world, emoted };
}
const start = () => newWorld(content, ctx('3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f'), [1, 2, 3, 4]);
const goblins = (w: World) =>
  Object.keys(w.state.created ?? {})
    .filter((e) => w.state.created![e].definition.kind === 'npc')
    .map(eid);

// Breaks: the emoter defaults to the actor (the player), the line drops its sight/room check, or an immune
// NPC (no status_applied) still cowers.
test('a shout in the den: one cower line per goblin that turns afraid, none for the guard', () => {
  const den = play(start(), { type: 'move', direction: 'east' }).w;
  const r = play(den, { type: 'shout', word: 'begone' });
  assert.deepEqual(r.emoted, ['A goblin cowers in fear.', 'A goblin cowers in fear.']);
});

// Breaks: the emote line is told to a reader who is not in the emoter's room.
test('a shout from the next room frightens the goblins and tells no cower line', () => {
  const r = play(start(), { type: 'shout', word: 'begone' });
  assert.deepEqual(r.emoted, []);
  const [a, b] = goblins(r.w);
  assert.ok(a && b && [a, b].every((g) => activeStatuses(r.w, g).length > 0), 'both afraid');
});

// Breaks: `to` resolves to the emoter, or the reader test (to.you) is swapped.
test('entering the inn: Nell bows to the reader; the captive brought in is bowed to by name', () => {
  const inn = play(start(), { type: 'move', direction: 'north' });
  assert.deepEqual(inn.emoted, ['Nell bows to you.']);
  const view = gameView(inn.w);
  assert.deepEqual(validate('GameView', view), []);
  assert.deepEqual(view.emotes, Object.values(content.emotes!));
  assert.deepEqual(play(inn.w, { type: 'say', word: 'fetch' }).emoted, [
    'Nell bows to the goblin.',
  ]);
});

// Breaks: the line binds a target that is elsewhere or that the reader does not see, or an NPC bows to
// itself.
test("Nell's bow names no target that is elsewhere, unseen or herself", () => {
  const w = play(start(), { type: 'move', direction: 'north' }).w;
  const ref = (k: string) => Object.keys(w.entityIds).find((r) => r.endsWith(`:npc/${k}`))!;
  const [nell, captive] = [w.entityIds[ref('nell')], w.entityIds[ref('captive')]];
  const bow = Object.values(content.reactions!).find(
    (r) => r.steps[0]?.op === 'emote' && r.steps[0].npc,
  )!.steps[0];
  const lines = (subject: typeof nell, at = w) =>
    told(at, w.character, bow as Told, { subject, steps: { n: 0 } });
  // The captive beside the reader but undiscovered (an NPC perception fact that is not true).
  const hidden = { ...(bow as { emote: object }).emote, key: 'hidden' };
  const unseen = {
    ...w,
    cartridge: {
      ...w.cartridge,
      facts: {
        ...w.cartridge.facts,
        [refString(hidden as DefinitionRef)]: { scopes: ['instance'] },
      },
    },
    entities: {
      ...w.entities,
      [captive]: { ...w.entities[captive], perception: { discovered: hidden } },
    },
    state: {
      ...w.state,
      containers: { ...w.state.containers, [captive]: w.state.containers[nell] },
    },
  } as World;
  assert.equal(
    lines(captive, { ...unseen, entities: w.entities })[0]?.bindings?.target,
    'npc.captive.short',
  );
  for (const [subject, at] of [
    [captive, w],
    [nell, w],
    [captive, unseen],
  ] as const)
    assert.deepEqual(lines(subject, at), [
      { key: 'emote.performed', participants: { actor: nell }, bindings: { emote: 'bow' } },
    ]);
});

// Breaks: the line is told by a non-NPC, a dead NPC or an emoter the reader does not see, a narrate step
// loses its text, or a step without `to` still names its subject.
test('told: only a living NPC the reader sees emotes; no `to`, no target', () => {
  const den = play(start(), { type: 'move', direction: 'east' }).w;
  const g = goblins(den)[0]!;
  const steps = Object.values(content.reactions!).flatMap((r) => r.steps);
  const cower = steps.find((s) => s.op === 'emote' && !s.npc)!;
  const lines = (at: World, subject: EntityId | undefined, s = cower) =>
    told(at, at.character, s as Told, { subject, steps: { n: 0 } });
  const one = [
    { key: 'emote.performed', participants: { actor: g }, bindings: { emote: 'cower' } },
  ];
  assert.deepEqual(lines(den, g), one);
  assert.deepEqual(
    told(den, den.character, { op: 'narrate', text: 'x.y' } as Told, { steps: { n: 0 } }),
    [{ key: 'x.y' }],
  );
  const [row] = Object.entries(den.state.resources!).filter(([k]) => k.includes(g));
  const dead = {
    ...den,
    state: {
      ...den.state,
      resources: { ...den.state.resources, [row![0]]: { ...row![1], value: 0 } },
    },
  } as World;
  const hidden = {
    cartridge_id: 'emote_sampler',
    cartridge_version: '0.0.1',
    kind: 'fact',
    key: 'hidden',
  };
  const unseen = {
    ...den,
    cartridge: {
      ...den.cartridge,
      facts: {
        ...den.cartridge.facts,
        [refString(hidden as DefinitionRef)]: { scopes: ['instance'] },
      },
    },
    entities: { ...den.entities, [g]: { ...den.entities[g], perception: { discovered: hidden } } },
  } as World;
  for (const [at, subject] of [
    [den, undefined],
    [den, bodyOf(den, den.character)],
    [dead, g],
    [unseen, g],
  ] as const)
    assert.deepEqual(lines(at, subject), []);
  // Nell's bow without `to`, its subject the captive she sees: no target.
  const inn = play(play(start(), { type: 'move', direction: 'north' }).w, {
    type: 'say',
    word: 'fetch',
  }).w;
  const bow = steps.find((s) => s.op === 'emote' && s.npc)!;
  const nell = inn.entityIds[Object.keys(inn.entityIds).find((r) => r.endsWith(':npc/nell'))!];
  const captive =
    inn.entityIds[Object.keys(inn.entityIds).find((r) => r.endsWith(':npc/captive'))!];
  assert.equal(lines(inn, captive, bow)[0]?.bindings?.target, 'npc.captive.short');
  assert.deepEqual(lines(inn, captive, { ...bow, to: undefined } as Told), [
    { key: 'emote.performed', participants: { actor: nell }, bindings: { emote: 'bow' } },
  ]);
});

// Breaks: the artifact or GameView schema drops an emote bound (a key, the emote map's key names, a
// non-empty emotes list).
test('the emote contracts refuse an emote without a key, a bad emote map key and an empty list', () => {
  const { cartridge } = JSON.parse(new TextDecoder().decode(artifact));
  const [ref, bow] = Object.entries(cartridge.emotes).find(([, e]) => (e as { to?: object }).to)!;
  const check = (emotes: object) => validate('CompiledCartridge', { ...cartridge, emotes });
  assert.deepEqual(check(cartridge.emotes), []);
  const { key: _, ...keyless } = bow as object & { key: string };
  for (const emotes of [
    { ...cartridge.emotes, [ref]: keyless },
    { ...cartridge.emotes, nope: bow },
  ])
    assert.notDeepEqual(check(emotes), [], JSON.stringify(emotes));
  const view = gameView(play(start(), { type: 'move', direction: 'north' }).w);
  assert.notDeepEqual(validate('GameView', { ...view, emotes: [] }), []);
});

// Breaks: the loader's key stage skips `emotes`, so an emote whose key differs from its map key loads.
test('an emote map key that disagrees with its emote is ARTIFACT_DEFINITION_KEY_MISMATCH', () => {
  const { cartridge } = JSON.parse(new TextDecoder().decode(artifact));
  const [ref, emote] = Object.entries(cartridge.emotes)[0] as [string, { key: string }];
  const declared = ref.split('/').pop();
  emote.key = 'other';
  const canonical = encode(cartridge);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  assert.ok(!r.ok);
  assert.deepEqual(
    [r.diagnostic.code, r.diagnostic.path, r.diagnostic.data],
    [
      'ARTIFACT_DEFINITION_KEY_MISMATCH',
      `.cartridge.emotes["${ref}"]`,
      { field: 'key', declared, expected: 'other' },
    ],
  );
});

// Breaks if the projection's size guard is off by one: an empty table projects `emotes: []` (a GameView
// the contract refuses), or a one-emote table projects none.
test('an emote table projects every emote, and an empty one none', () => {
  const view = (emotes: Cartridge['emotes']) =>
    gameView(
      newWorld({ ...content, emotes }, ctx('3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f'), [1, 2, 3, 4]),
    );
  const empty = view({});
  assert.equal('emotes' in empty, false);
  assert.deepEqual(validate('GameView', empty), []);
  const [one] = Object.entries(content.emotes!);
  assert.deepEqual(view(Object.fromEntries([one])).emotes, [one[1]]);
});
