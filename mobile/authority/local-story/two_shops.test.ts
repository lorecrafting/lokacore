// Two shops in one cartridge through real SQLite (save.md, B3 shop recovery; loka-kgd.149). Each
// world is a test-local clone of cartridges/prices_sampler whose fishmonger sells fish_a at a flat 5
// (no stock prices, so no receipt history replay vouches for a Buy) and whose fisher is a second
// shop, in pennies or a test-local currency, with the offers each test names.
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
import { coldReopen, elapsedHost } from './__tests__/elapsed-host.test.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const S = 'prices_sampler@0.0.1';

function twoShops(fisherOffers: object[], currency = 'pennies') {
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
    if (currency !== 'pennies')
      edit('resources.json', (r) => (r.resources[currency] = { ...r.resources.pennies }));
    edit(
      'npcs/fishmonger.json',
      (monger) => (monger.shop.offers = [{ item: 'fish_a', buy: 5, sell: 1 }]),
    );
    edit('npcs/fisher.json', (fisher) => {
      fisher.resource_starts = { pennies: 0, [currency]: 0 };
      fisher.shop = {
        resource: currency,
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
  /** Accepted, saved invocations, then the holders of fish_a and the basket and everyone's money. */
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
    ...[...new Set(['pennies', currency])].map((c) =>
      [w.body, monger, fisher].map((e) => level(w, e, resourceRef(w, c))),
    ),
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
/** Fish_a at the fishmonger for 5, then the basket at the fisher for 4. */
const twoBuys = ({
  monger,
  fisher,
  fish,
  basket,
}: typeof basketShop): [string, string[], object][] => [
  ['buy', [monger, fish], { quoted_price: 5 }],
  ['buy', [fisher, basket], { quoted_price: 4 }],
];

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
  const truth = play(path, twoBuys(basketShop));
  assert.deepEqual(truth, expected);
  assert.deepEqual(reopened(path), expected);
  coldReopen(path, basketShop.bundle);
});

// Breaks: a receipt is checked only under a shop it does not name, so its narration is never bound
// to that shop's bought line; or a receipt naming a provider that is not a shop, with no money ops
// and penny rows that agree with that, is never bound to any shop (a free basket).
test('a forged receipt at either shop, or naming no shop, is save_corrupt', (t) => {
  const { monger, fisher, fish, basket, initial, bundle, play, forge } = basketShop;
  const dir = scratchDir(t);
  const forgeries: [number, (command: any, response: any) => void][] = [
    [1, (_, response) => (response.narration = [{ key: 'shop.sold' }])],
    [2, (_, response) => (response.narration = [{ key: 'shop.sold' }])],
  ];
  for (const [i, [n, change]] of forgeries.entries()) {
    const path = join(dir, `forged-${i}.db`);
    play(path, twoBuys(basketShop));
    forge(path, n, change);
    assert.throws(() => elapsedHost(path, undefined, bundle), /save_corrupt/, String(i));
  }
  const path = join(dir, 'no-shop.db');
  play(path, twoBuys(basketShop));
  forge(path, 2, (command, response) => {
    command.payload.provider_id = initial.body;
    response.delta.ops = response.delta.ops.filter((o: any) => o.op !== 'resource.adjust');
  });
  const sql = new DatabaseSync(path);
  for (const [entity, pennies] of [
    [initial.body, 15],
    [fisher, 0],
  ] as const) {
    const changed = sql
      .prepare(
        "UPDATE state_row SET value=json_set(value,'$.value',?) WHERE section='resources' AND json_extract(key,'$.entity_id')=? AND json_extract(key,'$.resource.key')='pennies'",
      )
      .run(pennies, entity).changes;
    assert.equal(changed, 1); // exactly the penny row, so only the guard can refuse
  }
  sql.close();
  assert.throws(() => elapsedHost(path, undefined, bundle), /save_corrupt/);
});

// Breaks: another shop's receipt counts as a payment in this shop's currency, so a buy in shells
// at the fisher is save_corrupt under the fishmonger's pennies; or that receipt may carry penny ops.
test('one buy at each of two shops with different currencies survives cold reopen', (t) => {
  const shells = twoShops([{ item: 'basket', buy: 4, sell: 1 }], 'shells');
  const { initial, bundle, play, forge, reopened } = shells;
  const dir = scratchDir(t);
  const path = join(dir, 'shells.db');
  const body = initial.body;
  // Pennies: body 20 - 5, fishmonger 20 + 5, fisher 0; shells: body 20 - 4, fisher 0 + 4.
  const expected = [
    [body, body],
    [15, 25, 0],
    [16, 20, 4],
  ];
  const truth = play(path, twoBuys(shells));
  assert.deepEqual(truth, expected);
  assert.deepEqual(reopened(path), expected);
  // The fisher's shells buy also invents the same moves in pennies; the state rows are unchanged.
  const forged = join(dir, 'pennies-forged.db');
  play(forged, twoBuys(shells));
  forge(forged, 2, (_, response) =>
    response.delta.ops.push(
      ...response.delta.ops
        .filter((o: any) => o.op === 'resource.adjust')
        .map((o: any) => ({ ...o, resource: { ...o.resource, key: 'pennies' } })),
    ),
  );
  assert.throws(() => elapsedHost(forged, undefined, bundle), /save_corrupt/);
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
