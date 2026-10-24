// Source shortcut `signal` on the compiled test/fixtures/signal_sugar: `ring` sends bell on each
// entry into the hall, `hear` counts what it heard (docs/system/cartridge.md, Source shortcuts).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { DefinitionRef } from '../src/contracts.gen.ts';
import { value } from '../src/mechanics/fact.ts';
import { encode } from '../src/foundation/canonical.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-signal-sugar-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'test/fixtures/signal_sugar', file], {
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
const ref = (key: string) =>
  ({
    cartridge_id: 'signal_sugar',
    cartridge_version: '0.0.1',
    kind: 'fact',
    key,
  }) as DefinitionRef;
const fact = (w: World, key: string) => value(w, w.character, ref(key));

// The fixture changed by `change`, re-encoded, re-hashed and loaded again.
function reload(change: (c: Obj) => void) {
  const c = structuredClone(content) as unknown as Obj;
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  assert.ok(r.ok, JSON.stringify(r));
  return r.cartridge as Cartridge;
}

let n = 0;
// Start in the yard, then enter the hall, go back to the yard and enter the hall again.
function twice(c: Cartridge) {
  const start = newWorld(c, '5b2e7d1c-9a4f-4e3b-8c6d-000000000001' as never, [1, 2, 3, 4]);
  return ['east', 'west', 'east'].reduce((w, direction) => {
    n += 1;
    const id = `dddddddd-4194-4666-8444-${String(n).padStart(12, '0')}`;
    const payload = { actor_id: w.character, type: 'move', direction };
    const r = step(w, { id, world_context_id: w.context, payload } as never, n);
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    return r.world;
  }, start);
}

// Breaks: a send lowered to a one-shot write (fact.assign true hears only the first entry), or a
// listener that misses a send.
test('each entry into the hall sends bell once and is heard once', () => {
  const w = twice(content);
  assert.equal(fact(w, 'heard'), 2);
  assert.equal(fact(w, 'signal_bell'), 2);
});

// Breaks: a full counter that still wakes its listeners; documents the cap (cartridge.md, rule 6).
test('a send into a full counter is not heard', () => {
  const full = reload((c) => {
    const facts = c.facts as Record<string, { value_type: { default: number } }>;
    facts['signal_sugar@0.0.1:fact/signal_bell'].value_type.default = 9007199254740990;
  });
  const w = twice(full);
  assert.equal(fact(w, 'heard'), 1);
  assert.equal(fact(w, 'signal_bell'), 9007199254740991);
});
