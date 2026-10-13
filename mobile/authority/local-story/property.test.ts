// Toolbox rows 24 and 25 through real SQLite on cartridges/property_sampler: buying the hut, a
// deposit of 10 at branch A and its withdrawal at branch B (fee 1 each) survive cold reopen with
// the player's pennies, the vault's pennies and the savings account (docs/system/mechanics.md,
// Property and bank).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
  type World,
} from '../../../kernel/ts/src/index.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { level, resourceRef } from '../../../kernel/ts/src/mechanics/resource.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-property-save-'));
const file = join(scratch, 'artifact.json');
let artifact;
try {
  execFileSync('mix', ['loka.compile', 'cartridges/property_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = JSON.parse(readFileSync(file, 'utf8'));
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(new TextEncoder().encode(JSON.stringify(artifact)), INSTALLED);
if (!loaded.ok) throw new Error(JSON.stringify(loaded));
const bundle = { canonical: encode(artifact.cartridge), sha256: artifact.content_hash as string };
const initial = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
const releases = [{ fresh: initial, content_hash: bundle.sha256 }] as const;
const S = 'property_sampler@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'property_sampler', cartridge_version: '0.0.1', kind, key }) as never;
const npc = (k: string) => initial.entityIds[`${S}:npc/${k}`]!;
/** The player's pennies, the vault's pennies and `savings`. */
const books = (w: World) => [
  level(w, w.body, resourceRef(w, 'pennies')),
  level(w, npc('vault'), resourceRef(w, 'pennies')),
  value(w, w.character, ref('fact', 'savings')),
];

// Breaks: save recovery reconciles one payment pair per use_service, so the bank's second pair
// (10 pennies between the body and the vault) makes cold reopen save_corrupt.
test('the hut, a deposit at branch A and a withdrawal at branch B survive cold reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-property-saves-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'bank.db');
  let p = elapsedHost(path, undefined, bundle);
  let story = openStory(p.db, releases, p.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') return;
  let n = 0;
  const invoke = (action_key: string, target_ids: string[], input = {}) => {
    const r = (story as Extract<typeof story, { kind: 'open' }>).invoke({
      invocation_id: `cccccccc-2424-4024-8024-${String(++n).padStart(12, '0')}`,
      actor_id: initial.character,
      action_key,
      target_ids,
      input,
    });
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved') assert.equal((r.decision as any).kind, 'accepted', JSON.stringify(r));
  };
  const use = (action: string, provider: string, service: string, quoted_price: number) =>
    invoke(action, [npc(provider)], { service: ref('service', service), quoted_price });
  use('buy_hut', 'seller', 'buy_hut', 10);
  use('deposit', 'clerk_a', 'deposit_a', 1);
  assert.deepEqual(books(story.world()), [9, 30, 10]);
  invoke('move', [], { direction: 'east' });
  use('withdraw', 'clerk_b', 'withdraw_b', 1);
  assert.deepEqual(books(story.world()), [18, 20, 0]);
  p.sql.close();

  p = elapsedHost(path, undefined, bundle);
  story = openStory(p.db, releases, p.host);
  assert.equal(story.kind, 'open', JSON.stringify(story));
  if (story.kind !== 'open') return;
  assert.deepEqual(books(story.world()), [18, 20, 0]);
  p.sql.close();
});
