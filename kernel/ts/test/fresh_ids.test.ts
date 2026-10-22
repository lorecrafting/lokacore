// newWorld's fresh id allocation order (mechanics.md, A fresh world; numeric-profile.md, Initial
// world ids). Breaks: a reordered or skipped mint in runtime/fresh.ts (details, NPCs, items, jobs or
// slot holders) shifts every later id, which saves and transcripts carry. Answers are Python
// hashlib over the documented order (protocol/fixtures/generate_fresh_ids.py), never the kernel's.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { INSTALLED, newWorld } from '../src/runtime/world.ts';
import { read } from './read.ts';

const answers: Record<string, Record<string, string>> = read('protocol/fixtures/fresh_ids.json');

for (const [fixture, expected] of Object.entries(answers))
  test(`fresh ids of ${fixture} follow the documented order`, () => {
    const kat = read(`protocol/fixtures/${fixture}`);
    const loaded = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
      INSTALLED,
    );
    assert.ok(loaded.ok, JSON.stringify(loaded));
    const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as World['context'];
    const fresh = newWorld(loaded.cartridge as Cartridge, context, [1, 2, 3, 4]);
    const actual: Record<string, string> = { character: fresh.character, body: fresh.body };
    for (const [id, r] of Object.entries(fresh.rooms)) actual[`room/${r.key}`] = id;
    for (const [id, d] of Object.entries(fresh.details))
      actual[`detail/${fresh.rooms[d.room].key}/${d.key}`] = id;
    for (const [id, e] of Object.entries(fresh.entities)) actual[`${e.kind}/${e.key}`] = id;
    for (const [id, j] of Object.entries(fresh.state.jobs ?? {})) actual[`job/${j.job.key}`] = id;
    for (const [slot, id] of Object.entries(fresh.slots)) actual[`slot/${slot}`] = id;
    assert.deepEqual(actual, expected);
  });
