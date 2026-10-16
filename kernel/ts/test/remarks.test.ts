// Toolbox row FD10 on the compiled remarks sampler: an NPC's asides, read with the NPC as the
// target, show with it while it is present. Hal remarks on the cool crypt only as a group
// member (a pair fact read through `target`), once on the first visit, then again from the
// second; Bram, ungated, hums whenever he is seen.
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
import { key } from '../src/foundation/compose.ts';
import { validate } from '../src/foundation/validate.ts';
import { pending, talking } from '../src/mechanics/dialogue/shared.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-remarks-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/remarks_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
const C = 'remarks_sampler@0.0.1';
const HAL = `${C}:npc/hal`;

const load = (change: (c: any) => void) => {
  const c = structuredClone(source);
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  return r.ok
    ? (r.cartridge as Cartridge)
    : [r.diagnostic.code, r.diagnostic.path, r.diagnostic.data];
};
const content = load(() => {}) as Cartridge;

let n = 0;
const act = (w: World, p: object) => {
  const r = step(
    w,
    {
      id: `dddddddd-5555-4555-8555-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p },
    } as never,
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
const go = (w: World, ...dirs: string[]) =>
  dirs.reduce((x, direction) => act(x, { type: 'move', direction }), w);
// Pick `choice` with Hal, then leave the conversation.
const chat = (w: World, choice: string) => {
  const hal = w.entityIds[HAL] as EntityId;
  const talked = talking(w, w.character, hal) ? w : act(w, { type: 'talk', target_id: hal });
  const [continuation_id] = pending(talked, talked.character)!;
  const chosen = act(talked, { type: 'choose', choice_id: choice, continuation_id });
  const left = pending(chosen, chosen.character);
  return left ? act(chosen, { type: 'close_choice', continuation_id: left[0] }) : chosen;
};
// What the player sees: each present NPC's asides by key, in GameView order, and the place's.
const seen = (w: World) => {
  const v = gameView(w);
  assert.deepEqual(validate('GameView', v), []);
  return {
    npcs: v.entities
      .filter((e) => e.kind === 'npc')
      .map((e) => [w.entities[e.id]!.key, e.asides?.map((t) => t.key)]),
    place: v.place.asides,
  };
};
const fresh = (c: Cartridge = content) => {
  n = 0;
  return newWorld(c, '7a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d' as never, [1, 2, 3, 4]);
};

// Breaks: NPC asides not projected, read without the NPC as the target (Hal's pair fact never
// holds), ignoring `when` (Hal remarks in the yard or out of the group), a visit-count boundary
// off by one, or an absent NPC's lines shown.
test("Hal remarks on the crypt as a member, first then again; Bram's line is ungated", () => {
  let w = fresh();
  assert.deepEqual(seen(w), { npcs: [['hal', undefined]], place: undefined });
  w = go(chat(w, 'join'), 'north', 'east'); // crypt visit 1
  assert.deepEqual(seen(w), {
    npcs: [
      ['bram', ['remark.bram.hum']],
      ['hal', ['remark.hal.first']],
    ],
    place: undefined,
  });
  w = go(w, 'west'); // the road: not cool, Bram is not here
  assert.deepEqual(seen(w), { npcs: [['hal', undefined]], place: undefined });
  w = go(w, 'east'); // visit 2: the boundary of both gates
  assert.deepEqual(seen(w).npcs, [
    ['bram', ['remark.bram.hum']],
    ['hal', ['remark.hal.again']],
  ]);
  w = go(w, 'west', 'east'); // visit 3
  assert.deepEqual(seen(w).npcs, [
    ['bram', ['remark.bram.hum']],
    ['hal', ['remark.hal.again']],
  ]);
  w = chat(w, 'leave');
  assert.deepEqual(seen(w).npcs, [
    ['bram', ['remark.bram.hum']],
    ['hal', undefined],
  ]);
  w = chat(w, 'join');
  assert.deepEqual(seen(w).npcs[1], ['hal', ['remark.hal.again']]);
});

// Breaks: the PM's dark-room ruling (loka-kgd.147): darkness drops the room's asides (FD2), never a
// perceived NPC's, so the asides guard lost or applied to NPCs shows the room's line or hides Bram's.
test("in a dark crypt the room's aside hides and perceived Bram's remark shows", () => {
  const seenRef = {
    cartridge_id: 'remarks_sampler',
    cartridge_version: '0.0.1',
    kind: 'fact',
    key: 'bram_seen',
  };
  const dark = load((c) => {
    c.manifest.requires.capabilities.light = c.lock.capabilities.light = 1;
    const { per_subject: _, ...fact } = c.facts[`${C}:fact/in_group`];
    c.facts[`${C}:fact/bram_seen`] = { ...fact, key: 'bram_seen' };
    const crypt = c.rooms[`${C}:room/crypt`];
    crypt.dark_description = crypt.description;
    crypt.asides = c.npcs[`${C}:npc/bram`].asides;
    c.npcs[`${C}:npc/bram`].perception = { discovered: seenRef };
  });
  assert.ok(!Array.isArray(dark), JSON.stringify(dark));
  const w = go(fresh(dark as Cartridge), 'north', 'east');
  const perceived = { ...w, factDefaults: { ...w.factDefaults, [key(seenRef)]: true } };
  assert.deepEqual(seen(perceived), { npcs: [['bram', ['remark.bram.hum']]], place: undefined });
});

// Breaks: the loader stops walking NPC asides (an unknown fact or text loads and fails in play),
// lets a spawn template carry them, drops the 16 bound or the 1.107 floor (twin of
// content_remarks_test.exs).
test('the loader checks NPC asides: references, text, template, bound and floor', () => {
  const at = `.cartridge.npcs[${JSON.stringify(HAL)}].asides`;
  const bram = `${C}:npc/bram`;
  const rows: [(c: any) => void, unknown][] = [
    [
      (c) => (c.npcs[HAL].asides[0].text = 'nope'),
      ['UNRESOLVED_REFERENCE', `${at}[0].text`, { target: 'nope' }],
    ],
    [
      (c) => (c.npcs[HAL].asides[0].when.root.items[0].fact.key = 'ghost'),
      [
        'UNRESOLVED_REFERENCE',
        `${at}[0].when.root.items[0].fact`,
        { target: `remarks_sampler@0.0.1:fact/ghost` },
      ],
    ],
    [
      (c) => (c.npcs[bram].spawn_template = true),
      [
        'SCHEMA_VIOLATION',
        `.cartridge.npcs[${JSON.stringify(bram)}].asides`,
        { error: 'invalid_value' },
      ],
    ],
    [
      (c) => (c.npcs[HAL].asides = Array(17).fill(c.npcs[HAL].asides[1])),
      ['SCHEMA_VIOLATION', at, { error: 'too_many_items' }],
    ],
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.106'),
      ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least', {}],
    ],
  ];
  for (const [change, want] of rows) {
    const got = load(change);
    assert.deepEqual(Array.isArray(got) ? got : 'loaded', want);
  }
  assert.ok(
    !Array.isArray(load((c) => (c.npcs[HAL].asides = Array(16).fill(c.npcs[HAL].asides[1])))),
  );
});
