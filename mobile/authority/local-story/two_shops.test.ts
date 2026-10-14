// Two shops in one cartridge through real SQLite (save.md, B3 shop recovery; loka-kgd.149): a test-local
// clone of cartridges/prices_sampler drops the stock prices (so no receipt history replay vouches for
// a Buy) and makes the fisher a second penny shop selling the basket. One buy at each shop survives
// cold reopen; a forged receipt at either shop is still save_corrupt.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
import { level, resourceRef } from '../../../kernel/ts/src/mechanics/resource.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'loka-two-shops-'));
let artifact;
try {
  const src = join(scratch, 'prices_sampler');
  cpSync(join(root, 'cartridges/prices_sampler'), src, { recursive: true });
  const edit = (file: string, change: (json: any) => void) => {
    const json = JSON.parse(readFileSync(join(src, file), 'utf8'));
    change(json);
    writeFileSync(join(src, file), JSON.stringify(json));
  };
  edit(
    'npcs/fishmonger.json',
    (monger) => (monger.shop.offers = [{ item: 'fish_a', buy: 5, sell: 1 }]),
  );
  edit('npcs/fisher.json', (fisher) => {
    fisher.resource_starts = { pennies: 0 };
    fisher.shop = {
      resource: 'pennies',
      offers: [{ item: 'basket', buy: 4, sell: 1 }],
      bought: 'shop.bought',
      sold: 'shop.sold',
    };
  });
  edit('items/basket.json', (basket) => (basket.location.npc = 'fisher'));
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', src, file], { cwd: root, stdio: 'pipe' });
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
const S = 'prices_sampler@0.0.1';
const id = (ref: string) => initial.entityIds[`${S}:${ref}`]!;
const [monger, fisher, fish, basket] = [
  id('npc/fishmonger'),
  id('npc/fisher'),
  id('item/fish_a'),
  id('item/basket'),
];
/** Whether the player holds the basket; the player's, the fishmonger's and the fisher's pennies. */
const truth = (w: World) => [
  w.state.containers[basket] === w.body,
  ...[w.body, monger, fisher].map((e) => level(w, e, resourceRef(w, 'pennies'))),
];

/** A save with fish_a bought at the fishmonger (5), then the basket at the fisher (4). */
function twoBuys(dir: string, name: string) {
  const path = join(dir, name);
  const p = elapsedHost(path, undefined, bundle);
  const story = openStory(p.db, releases, p.host);
  if (story.kind !== 'open') throw new Error('not open');
  for (const [i, [provider, item, quoted_price]] of [
    [monger, fish, 5],
    [fisher, basket, 4],
  ].entries()) {
    const r = story.invoke({
      invocation_id: `dddddddd-2121-4020-8020-${String(i + 1).padStart(12, '0')}`,
      actor_id: initial.character,
      action_key: 'buy',
      target_ids: [provider, item],
      input: { quoted_price },
    });
    assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
  }
  assert.deepEqual(truth(story.world()), [true, 11, 25, 4]);
  return { path, p };
}

// Breaks: commerce recovery checks each receipt against every shop (a buy at one shop is
// save_corrupt under the other) or credits the payment to the shop being checked.
test('one buy at each of two shops survives cold reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-two-shops-save-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { path, p } = twoBuys(dir, 'two.db');
  p.sql.close();
  const again = elapsedHost(path, undefined, bundle);
  const story = openStory(again.db, releases, again.host);
  assert.equal(story.kind, 'open', JSON.stringify(story));
  if (story.kind === 'open') assert.deepEqual(truth(story.world()), [true, 11, 25, 4]);
  again.sql.close();
});

// Breaks: a receipt is checked only under a shop it does not name, so its narration is never bound
// to that shop's bought line.
test('a forged receipt at either shop is save_corrupt', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-two-shops-forged-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [i, provider] of [monger, fisher].entries()) {
    const { path, p } = twoBuys(dir, `forged-${i}.db`);
    const row = p.sql
      .prepare(
        "SELECT invocation_id,response FROM receipt WHERE json_extract(command,'$.payload.provider_id')=?",
      )
      .get(provider)!;
    const d = JSON.parse(row.response as string);
    d.narration = [{ key: 'shop.sold' }];
    p.sql
      .prepare('UPDATE receipt SET response=? WHERE invocation_id=?')
      .run(JSON.stringify(d), row.invocation_id as string);
    p.sql.close();
    assert.throws(() => elapsedHost(path, undefined, bundle), /save_corrupt/, provider);
  }
});
