// NPC emotes (G9, emote@1; docs/system/mechanics.md#npc-emotes-g9) on the compiled emote sampler: the
// hall (entry), the goblins' den east of it with an immune guard, the inn north with Nell (who bows to
// whoever enters), a goblin captive in a cell north of the inn that "fetch" brings to the inn.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import { type Cartridge, type World } from '../src/runtime/decision.ts';
import { activeStatuses } from '../src/mechanics/status/shared.ts';
import { validate } from '../src/foundation/validate.ts';
import { gameView } from '../src/view/view.ts';
import { spoken } from '../play/spoken.ts';
import { told } from '../src/mechanics/emote/line.ts';
import { ctx } from './harness.ts';

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
const id = () => `eeeeeeee-2121-4121-8121-${String(++n).padStart(12, '0')}` as never;
/** One accepted command and the English of its emote lines, as the terminal client words them. */
function play(w: World, payload: object) {
  const r = step(
    w,
    {
      id: id(),
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
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
  Object.keys(w.state.created ?? {}).filter((e) => w.state.created![e].definition.kind === 'npc');

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
  assert.ok(
    a && b && [a, b].every((g) => activeStatuses(r.w, g as never).length > 0),
    'both afraid',
  );
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

// Breaks: the line binds a target the reader cannot see from the room, or an NPC bows to itself.
test("Nell's bow names no target that is elsewhere or herself", () => {
  const w = play(start(), { type: 'move', direction: 'north' }).w;
  const ref = (k: string) => Object.keys(w.entityIds).find((r) => r.endsWith(`:npc/${k}`))!;
  const [nell, captive] = [w.entityIds[ref('nell')], w.entityIds[ref('captive')]];
  const bow = Object.values(content.reactions!).find(
    (r) => r.steps[0]?.op === 'emote' && r.steps[0].npc,
  )!.steps[0];
  const lines = (subject: typeof nell) =>
    told(w, w.character, bow as never, { subject, steps: { n: 0 } });
  for (const subject of [captive, nell])
    assert.deepEqual(lines(subject), [
      { key: 'emote.performed', participants: { actor: nell }, bindings: { emote: 'bow' } },
    ]);
});
