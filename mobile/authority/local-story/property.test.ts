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
import { coldReopen, elapsedHost } from './__tests__/elapsed-host.test.ts';

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

/** A fresh save on the sampler; `invoke` asserts saved and accepted unless `replay`. */
function session(t: { after: (f: () => void) => void }) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-property-saves-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'bank.db');
  let n = 0;
  const s = {
    path,
    p: elapsedHost(path, undefined, bundle),
    story: undefined as unknown as Extract<ReturnType<typeof openStory>, { kind: 'open' }>,
    open() {
      const story = openStory(s.p.db, releases, s.p.host);
      if (story.kind === 'open') s.story = story;
      return story;
    },
    reopen() {
      s.p.sql.close();
      s.p = elapsedHost(path, undefined, bundle);
      return s.open();
    },
    invoke(action_key: string, target_ids: string[], input = {}, id = ++n) {
      const r = s.story.invoke({
        invocation_id: `cccccccc-2424-4024-8024-${String(id).padStart(12, '0')}`,
        actor_id: initial.character,
        action_key,
        target_ids,
        input,
      });
      assert.equal(r.kind, 'saved', JSON.stringify(r));
      if (r.kind === 'saved') assert.equal((r.decision as any).kind, 'accepted', JSON.stringify(r));
      return r;
    },
    use(action: string, provider: string, service: string, id?: number) {
      const price = service === 'buy_hut' ? 10 : 1;
      const input = { service: ref('service', service), quoted_price: price };
      return s.invoke(action, [npc(provider)], input, id);
    },
  };
  assert.equal(s.open().kind, 'open');
  return s;
}

// Breaks: save recovery reconciles one payment pair per use_service (the bank's second pair, 10
// pennies between the body and the vault, makes cold reopen save_corrupt), the withdraw pair
// expected after its fee, or a lost-ack retry of the deposit not replayed (it charges again).
test('the hut, a deposit at branch A and a withdrawal at branch B survive cold reopen', (t) => {
  const s = session(t);
  s.use('buy_hut', 'seller', 'buy_hut');
  s.use('deposit', 'clerk_a', 'deposit_a');
  assert.deepEqual(books(s.story.world()), [9, 30, 10]);
  const again = s.use('deposit', 'clerk_a', 'deposit_a', 2);
  if (again.kind === 'saved') assert.equal(again.replay, true);
  assert.deepEqual(books(s.story.world()), [9, 30, 10]);
  s.invoke('move', [], { direction: 'east' });
  s.use('withdraw', 'clerk_b', 'withdraw_b');
  assert.deepEqual(books(s.story.world()), [18, 20, 0]);

  assert.equal(s.reopen().kind, 'open');
  assert.deepEqual(books(s.story.world()), [18, 20, 0]);
  s.p.sql.close();
  coldReopen(s.path, bundle);
});

// Breaks: reopen trusts a stored savings row the receipts do not produce (10 forged to 11).
test('a forged savings row reopens save_corrupt', (t) => {
  const s = session(t);
  s.use('deposit', 'clerk_a', 'deposit_a');
  assert.deepEqual(books(s.story.world()), [19, 30, 10]);
  const row = Object.keys(s.story.world().state.facts ?? {}).find(
    (k) => JSON.parse(k).fact.key === 'savings',
  )!;
  const forged = s.p.sql
    .prepare("UPDATE state_row SET value='11' WHERE section='facts' AND key=?")
    .run(row);
  assert.equal(forged.changes, 1);
  const snapshot = s.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
  assert.equal(openStory(s.p.db, releases, s.p.host).kind, 'save_corrupt');
  assert.deepEqual(s.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(), snapshot);
  s.p.sql.close();
});
