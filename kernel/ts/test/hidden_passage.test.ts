// Toolbox row 11 on the compiled hidden sampler: the hall's east face to the study is hidden until
// the player fact panel_found; searching the panel sets it. The gallery joins hall and study by
// another route, and the study's west face back to the hall is not hidden (mechanics.md hidden
// passages).
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
import { encode } from '../src/foundation/canonical.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-hidden-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/hidden_sampler', file], {
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
const P = 'hidden_sampler@0.0.1';

// Breaks: move admission ignores hidden_until (a forged Move walks through the panel), the exit list
// or scan shows the hidden face, the map links it once both ends are visited by another route, a
// hidden face also hides its unhidden reciprocal, or the search does not reveal it.
test('a forged Move through the panel is not_found until the search; then the exit shows and opens', () => {
  let n = 0;
  let w: World = newWorld(content, '3c5e7a9b-1d2f-4a6b-8c0d-2e4f6a8b0c1e' as never, [1, 2, 3, 4]);
  const send = (payload: object) => {
    const r = step(
      w,
      {
        id: `eeeeeeee-9999-4999-8999-${String(++n).padStart(12, '0')}`,
        world_context_id: w.context,
        payload: { actor_id: w.character, ...payload },
      } as never,
      n,
    );
    if (r.decision.kind === 'accepted') w = r.world;
    return r.decision as { kind: string; error?: { code: string } };
  };
  const exits = () => gameView(w).exits.map((e) => e.direction);
  const links = (title: string) =>
    gameView(w)
      .map!.links.filter((l) => w.rooms[l.from].title === `room.${title}.title`)
      .map((l) => l.direction);

  assert.deepEqual(exits(), ['north']);
  const forged = send({ type: 'move', direction: 'east' });
  assert.deepEqual([forged.kind, forged.error?.code], ['rejected', 'not_found']);

  for (const direction of ['north', 'east', 'west'])
    assert.equal(send({ type: 'move', direction }).kind, 'accepted');
  assert.equal(w.rooms[w.state.containers[w.body]].title, 'room.hall.title');
  assert.deepEqual(links('hall'), ['north']);
  assert.deepEqual(links('study'), ['north', 'west']);

  assert.equal(send({ type: 'perform', action: 'search_panel' }).kind, 'accepted');
  assert.deepEqual(exits(), ['east', 'north']);
  assert.deepEqual(links('hall'), ['east', 'north']);
  assert.equal(send({ type: 'move', direction: 'east' }).kind, 'accepted');
  assert.equal(w.rooms[w.state.containers[w.body]].title, 'room.study.title');
});

// Breaks: the loader drops a hidden_until check, so an unknown or mistyped fact, a hidden face with
// a barrier (a door verb would find it) or an old API floor loads.
test('the loader refuses each unsound hidden_until declaration', () => {
  const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  const face = `.cartridge.rooms["${P}:room/hall"].exits.east.hidden_until`;
  const until = (c: any) => c.rooms[`${P}:room/hall`].exits.east.hidden_until;
  const rows: [(c: any) => void, string, string][] = [
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.44'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [(c) => (until(c).fact.key = 'panel_lost'), 'UNRESOLVED_REFERENCE', `${face}.fact`],
    [(c) => (until(c).equals = 1), 'FACT_TYPE_MISMATCH', `${face}.equals`],
    [
      (c) => {
        // A well-formed door on both faces, so only the hidden face's own rule refuses it.
        const door = { ...until(c).fact, kind: 'barrier', key: 'panel' };
        c.barriers = {
          [`${P}:barrier/panel`]: {
            key: 'panel',
            keywords: ['panel'],
            short: 'detail.panel',
            initial: 'open',
          },
        };
        c.lock.capabilities.barrier = c.manifest.requires.capabilities.barrier = 1;
        c.rooms[`${P}:room/hall`].exits.east.barrier = door;
        c.rooms[`${P}:room/study`].exits.west.barrier = door;
      },
      'BARRIER_MISMATCH',
      face,
    ],
  ];
  for (const [change, code, path] of rows) {
    const c = structuredClone(source);
    change(c);
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const r = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
      INSTALLED,
    );
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [code, path], path);
  }
});
