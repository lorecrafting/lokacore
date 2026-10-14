// Two shops in one cartridge through real SQLite (save.md, B3 shop recovery; loka-kgd.149). Each
// world is a test-local clone of cartridges/prices_sampler whose fishmonger sells fish_a at a flat 5
// (no stock prices, so no receipt history replay vouches for a Buy) and whose fisher is a second
// penny shop with the offers each test names.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
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
const S = 'prices_sampler@0.0.1';

function twoShops(fisherOffers: object[]) {
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
        offers: fisherOffers,
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
  const id = (ref: string) => initial.entityIds[`${S}:${ref}`]!;
  const [monger, fisher, fish, basket] = [
    id('npc/fishmonger'),
    id('npc/fisher'),
    id('item/fish_a'),
    id('item/basket'),
  ];
  const open = (path: string) => {
    const p = elapsedHost(path, undefined, bundle);
    const story = openStory(p.db, releases, p.host);
    if (story.kind !== 'open') throw new Error(JSON.stringify(story));
    return { p, story };
  };
  /** Accepted, saved invocations, then the holders of fish_a and the basket and everyone's pennies. */
  const play = (path: string, steps: [string, string[], object][]) => {
    const { p, story } = open(path);
    for (const [i, [action_key, target_ids, input]] of steps.entries()) {
      const r = story.invoke({
        invocation_id: `dddddddd-2121-4020-8020-${String(i + 1).padStart(12, '0')}`,
        actor_id: initial.character,
        action_key,
        target_ids,
        input,
      });
      assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
    }
    const truth = summary(story.world());
    p.sql.close();
    return truth;
  };
  const summary = (w: World) => [
    [fish, basket].map((item) => w.state.containers[item]),
    [w.body, monger, fisher].map((e) => level(w, e, resourceRef(w, 'pennies'))),
  ];
  /** Rewrite the stored receipt of the invocation numbered `n` (1-based). */
  const forge = (path: string, n: number, change: (command: any, response: any) => void) => {
    const sql = new DatabaseSync(path);
    const where = `dddddddd-2121-4020-8020-${String(n).padStart(12, '0')}`;
    const row = sql
      .prepare('SELECT command,response FROM receipt WHERE invocation_id=?')
      .get(where)!;
    const [command, response] = [
      JSON.parse(row.command as string),
      JSON.parse(row.response as string),
    ];
    change(command, response);
    sql
      .prepare('UPDATE receipt SET command=?,response=? WHERE invocation_id=?')
      .run(JSON.stringify(command), JSON.stringify(response), where);
    sql.close();
  };
  const reopened = (path: string) => {
    const { p, story } = open(path);
    const truth = summary(story.world());
    p.sql.close();
    return truth;
  };
  return { bundle, initial, monger, fisher, fish, basket, play, forge, reopened };
}

const basketShop = twoShops([{ item: 'basket', buy: 4, sell: 1 }]);

function scratchDir(t: { after(fn: () => void): void }) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-two-shops-save-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// Breaks: commerce recovery checks each receipt against every shop (a buy at one shop is
// save_corrupt under the other) or credits the payment to the shop being checked.
test('one buy at each of two shops survives cold reopen', (t) => {
  const { monger, fisher, fish, basket, initial, play, reopened } = basketShop;
  const path = join(scratchDir(t), 'two.db');
  const body = initial.body;
  const expected = [
    [body, body],
    [11, 25, 4],
  ];
  const truth = play(path, [
    ['buy', [monger, fish], { quoted_price: 5 }],
    ['buy', [fisher, basket], { quoted_price: 4 }],
  ]);
  assert.deepEqual(truth, expected);
  assert.deepEqual(reopened(path), expected);
});

// Breaks: a receipt is checked only under a shop it does not name, so its narration is never bound
// to that shop's bought line; or a receipt naming a provider that is not a shop is never bound to
// any shop.
test('a forged receipt at either shop, or naming no shop, is save_corrupt', (t) => {
  const { monger, fisher, fish, basket, initial, bundle, play, forge } = basketShop;
  const dir = scratchDir(t);
  const forgeries: [number, (command: any, response: any) => void][] = [
    [1, (_, response) => (response.narration = [{ key: 'shop.sold' }])],
    [2, (_, response) => (response.narration = [{ key: 'shop.sold' }])],
    [2, (command) => (command.payload.provider_id = initial.body)],
  ];
  for (const [i, [n, change]] of forgeries.entries()) {
    const path = join(dir, `forged-${i}.db`);
    play(path, [
      ['buy', [monger, fish], { quoted_price: 5 }],
      ['buy', [fisher, basket], { quoted_price: 4 }],
    ]);
    forge(path, n, change);
    assert.throws(() => elapsedHost(path, undefined, bundle), /save_corrupt/, String(i));
  }
});

// Breaks: the fishmonger's custody ignores a move of its fish_a made by the fisher's stock offer
// (the lawful history is save_corrupt), or accepts a forged one.
test("another shop's stock offer moving a tracked item reopens; a forged move is save_corrupt", (t) => {
  // The fisher's stock prices basket and fish_a at 4 with one held and 3 with two held.
  const { monger, fisher, fish, basket, initial, bundle, play, forge, reopened } = twoShops([
    { item: 'basket', buy: 4, sell: 1, stock: { items: ['basket', 'fish_a'], buy: [4, 3] } },
  ]);
  const dir = scratchDir(t);
  const steps: [string, string[], object][] = [
    ['buy', [monger, fish], { quoted_price: 5 }],
    ['give', [fish, fisher], {}],
    ['buy', [fisher, basket], { quoted_price: 3 }],
    ['buy', [fisher, basket], { quoted_price: 4 }],
  ];
  const expected = [
    [initial.body, initial.body],
    [8, 25, 7],
  ];
  const lawful = join(dir, 'lawful.db');
  assert.deepEqual(play(lawful, steps), expected);
  assert.deepEqual(reopened(lawful), expected);
  // The two stock Buys swap which item each moved: the final rows still match.
  const forged = join(dir, 'forged.db');
  play(forged, steps);
  const swap = (response: any) => {
    const move = response.delta.ops.find((o: any) => o.op === 'entity.transfer');
    move.entity_id = move.entity_id === fish ? basket : fish;
  };
  forge(forged, 3, (_, response) => swap(response));
  forge(forged, 4, (_, response) => swap(response));
  assert.throws(() => elapsedHost(forged, undefined, bundle), /save_corrupt/);
});
