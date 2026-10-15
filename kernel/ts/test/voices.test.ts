// Toolbox row FD2 on the compiled voices sampler: the skill_compare leaf and room and detail
// asides. Studying the runes raises lore (growth [1, 2]); asides, the sage's line and the
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
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { encode } from '../src/foundation/canonical.ts';
import { describeEntity } from '../src/mechanics/description_variant/rule.ts';

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
// What the player sees: the hall's asides, the door's asides, the sage's line, decipher offered.
const seen = (w: World) => {
  const v = gameView(w);
  const door = v.notices?.find((x) => w.details[x.id]?.key === 'carved_door');
  return {
    hall: v.place.asides?.map((t) => t.key),
    door: door?.asides?.map((t) => t.key),
    sage: describeEntity(w, w.character, w.entityIds[`${C}:npc/sage`] as EntityId, 'room_line'),
    decipher: door?.actions?.find((a) => a.action_key === 'read_glyphs')?.available === true,
  };
};
const fresh = () =>
  newWorld(content, '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b' as never, [5, 6, 7, 8]);

// Breaks: skill_compare reading the attribute, membership alone or a strict comparison; asides
// ignoring `when`, losing authored order or not projected on the place or the notice; the
// leaf not gating room_line_variants or a recipe policy.
test('lore 0, 1 and 2 show more asides, the scholar line and the decipher action', () => {
  let w = fresh();
  assert.deepEqual(seen(w), {
    hall: undefined,
    door: undefined,
    sage: 'npc.sage.line',
    decipher: false,
  });
  assert.equal(perform(w, 'read_glyphs').decision.kind, 'rejected');
  w = study(w); // lore 1
  assert.deepEqual(seen(w), {
    hall: ['aside.hall.lore'],
    door: ['aside.door.glance'],
    sage: 'npc.sage.line',
    decipher: false,
  });
  w = study(w); // lore 2: the last growth threshold
  assert.deepEqual(seen(w), {
    hall: ['aside.hall.lore'],
    door: ['aside.door.lore', 'aside.door.glance'],
    sage: 'npc.sage.line.scholar',
    decipher: true,
  });
  assert.equal(perform(w, 'read_glyphs').decision.kind, 'accepted');
});

// Breaks: asides shown while the room's dark description replaces its text (sighted lines in the
// dark), or a board notice not carrying its detail's asides.
test('a dark room shows no asides; a board notice carries its detail asides', () => {
  const w = study(study(fresh())); // lore 2
  const room = w.roomIds[`${C}:room/hall`]!;
  const runes = Object.keys(w.details).find((id) => w.details[id]!.key === 'runes')!;
  const notice_board = { title: 'board', notices: [{ detail: 'carved_door', title: 'door' }] };
  const boarded = {
    ...w,
    details: { ...w.details, [runes]: { ...w.details[runes]!, notice_board } },
  };
  assert.deepEqual(
    gameView(boarded as World).notice_boards?.[0]?.notices[0]?.asides?.map((t) => t.key),
    ['aside.door.lore', 'aside.door.glance'],
  );
  const dim = { ...w, rooms: { ...w.rooms, [room]: { ...w.rooms[room]!, dark_description: 'x' } } };
  assert.equal(gameView(dim as World).place.asides, undefined);
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
const door = `.cartridge.rooms[${JSON.stringify(hall)}].details.carved_door`;

// Breaks: the loader stops walking asides (an undeclared skill or a missing text key loads and
// fails in play), the leaf loses its owner, or the 1.91 floor misses asides or a lone leaf
// (twin of content_voices_test.exs).
test('the loader checks asides and skill_compare: references, text, owner and floor', () => {
  const rows: [(c: any) => void, unknown[]][] = [
    [
      (c) => (c.rooms[hall].details.carved_door.asides[0].when.root.skill.key = 'ghost'),
      ['UNRESOLVED_REFERENCE', `${door}.asides[0].when.root.skill`, { target: `${C}:skill/ghost` }],
    ],
    [
      (c) => (c.rooms[hall].asides[0].text = 'aside.gone'),
      [
        'UNRESOLVED_REFERENCE',
        `.cartridge.rooms[${JSON.stringify(hall)}].asides[0].text`,
        { target: 'aside.gone' },
      ],
    ],
    [
      (c) => {
        delete c.manifest.requires.capabilities.skills;
        delete c.lock.capabilities.skills;
        delete c.npcs[`${C}:npc/sage`].room_line_variants;
        delete c.recipes[`${C}:recipe/read_glyphs`];
      },
      [
        'UNDECLARED_CAPABILITY',
        `.cartridge.rooms[${JSON.stringify(hall)}].asides[0].when.root.op`,
        { capability: 'skills' },
      ],
    ],
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.90'),
      ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least', {}],
    ],
    [
      (c) => {
        c.manifest.requires.kernel_api.at_least = '1.90';
        delete c.rooms[hall].asides;
        delete c.rooms[hall].details.carved_door.asides;
      },
      ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least', {}],
    ],
  ];
  for (const [change, expected] of rows) {
    assert.deepEqual(load(change), expected);
  }
});
