// Toolbox row FD2 on the compiled voices sampler: the skill_compare leaf (asides retired,
// loka-x6t.125). Studying the runes raises lore (growth [1, 2]); the sage's line and the
// decipher recipe follow the level.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import { validate } from '../src/foundation/validate.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { encode } from '../src/foundation/canonical.ts';
import { describeEntity } from '../src/mechanics/description_variant/rule.ts';
import { ctx } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-voices-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/voices_sampler', file], {
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
const C = 'voices_sampler@0.0.1';
const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
let n = 0;
const perform = (w: World, action: string) => {
  n += 1;
  return step(
    w,
    {
      id: `eeeeeeee-7777-4777-8777-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, type: 'perform', action },
    } as never,
    n,
  );
};
const study = (w: World) => {
  const r = perform(w, 'study_runes');
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
// What the player sees: the sage's line and whether decipher is offered on the door.
const seen = (w: World) => {
  const door = gameView(w).notices?.find((x) => w.details[x.id]?.key === 'carved_door');
  return {
    sage: describeEntity(w, w.character, w.entityIds[`${C}:npc/sage`] as EntityId, 'room_line'),
    decipher: door?.actions?.find((a) => a.action_key === 'read_glyphs')?.available === true,
  };
};
const fresh = () => newWorld(content, ctx('6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b'), [5, 6, 7, 8]);

// Breaks: skill_compare reading the attribute, membership alone or a strict comparison; the
// leaf not gating room_line_variants or a recipe policy.
test('lore 0, 1 and 2: the scholar line and the decipher action wait for lore 2', () => {
  let w = fresh();
  const before = { sage: 'npc.sage.line', decipher: false };
  assert.deepEqual(seen(w), before);
  assert.equal(perform(w, 'read_glyphs').decision.kind, 'rejected');
  w = study(w); // lore 1
  assert.deepEqual(seen(w), before);
  w = study(w); // lore 2: the last growth threshold
  assert.deepEqual(seen(w), { sage: 'npc.sage.line.scholar', decipher: true });
  assert.equal(perform(w, 'read_glyphs').decision.kind, 'accepted');
  assert.deepEqual(validate('GameView', gameView(w)), []);
});

const load = (change: (c: any) => void) => {
  const c = structuredClone(source);
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path, r.diagnostic.data];
};
const hall = `${C}:room/hall`;
const sage = `${C}:npc/sage`;
const glyphs = `${C}:recipe/read_glyphs`;
const floor = ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least', {}];

// Breaks: the skill_compare leaf loses its owner, the 1.91 floor misses a lone leaf, or a retired `asides` field loads
// (twin of content_voices_test.exs).
test('the loader checks skill_compare (owner, floor) and refuses asides', () => {
  const rows: [(c: any) => void, unknown][] = [
    [
      (c) => {
        delete c.manifest.requires.capabilities.skills;
        delete c.lock.capabilities.skills;
        delete c.recipes[glyphs];
      },
      [
        'UNDECLARED_CAPABILITY',
        `.cartridge.npcs[${JSON.stringify(sage)}].room_line_variants[0].when.root.op`,
        { capability: 'skills' },
      ],
    ],
    [(c) => (c.manifest.requires.kernel_api.at_least = '1.90'), floor],
    [
      (c) => {
        c.manifest.requires.kernel_api.at_least = '1.90';
        delete c.recipes[glyphs];
      },
      floor,
    ],
    [
      (c) => {
        c.manifest.requires.kernel_api.at_least = '1.90';
        delete c.npcs[sage].room_line_variants;
        delete c.recipes[glyphs];
      },
      'loaded',
    ],
    [
      (c) => (c.rooms[hall].asides = []),
      ['UNKNOWN_FIELD', `.cartridge.rooms[${JSON.stringify(hall)}].asides`, {}],
    ],
  ];
  for (const [change, expected] of rows) {
    assert.deepEqual(load(change), expected);
  }
});
