// Toolbox row W11 through real SQLite on cartridges/prices_sampler (docs/system/mechanics.md,
// Stock-sensitive prices; save.md, B3 shop recovery): two fish bought at two prices (2 with three
// held, 3 with two held) survive cold reopen; the second Buy replays; a failed COMMIT on the third
// (5 with one held) keeps all-prior rows and its retry saves. This world context's EntityIds sort
// fish_b < fish_a < fish_c, so the buys move fish_b, then fish_a, then fish_c.
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
import { level, resourceRef } from '../../../kernel/ts/src/mechanics/resource.ts';
import { openStory } from './authority.ts';
import { coldReopen, elapsedHost } from './__tests__/elapsed-host.test.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-prices-save-'));
const file = join(scratch, 'artifact.json');
let artifact;
try {
  execFileSync('mix', ['loka.compile', 'cartridges/prices_sampler', file], {
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
const S = 'prices_sampler@0.0.1';
const fish = (k: string) => initial.entityIds[`${S}:item/fish_${k}`]!;
const monger = initial.entityIds[`${S}:npc/fishmonger`]!;
/** Which of fish a, b, c the player holds; the player's and the fishmonger's pennies. */
const truth = (w: World) => [
  ['a', 'b', 'c'].map((k) => w.state.containers[fish(k)] === w.body),
  level(w, w.body, resourceRef(w, 'pennies')),
  level(w, monger, resourceRef(w, 'pennies')),
];

// Breaks: save recovery compares a stock quote with the flat buy 5 or tracks fish_a as the moved
// item (cold reopen is save_corrupt), the receipt is not replayed (the retry buys again), or a
// failed COMMIT keeps half a purchase.
test('two fish bought at two prices survive cold reopen; a failed COMMIT keeps all-prior', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-prices-saves-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'market.db');
  let n = 0;
  const buy = (quoted_price: number) => ({
    invocation_id: `aaaaaaaa-2121-4020-8020-${String(++n).padStart(12, '0')}`,
    actor_id: initial.character,
    action_key: 'buy',
    target_ids: [monger, fish('a')],
    input: { quoted_price },
  });
  const reopen = () => {
    const p = elapsedHost(path, undefined, bundle);
    const story = openStory(p.db, releases, p.host);
    assert.equal(story.kind, 'open', JSON.stringify(story));
    if (story.kind !== 'open') throw new Error('not open');
    return { p, story };
  };
  const saved = (story: ReturnType<typeof reopen>['story'], i: ReturnType<typeof buy>) => {
    const r = story.invoke(i);
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved') assert.equal((r.decision as any).kind, 'accepted', JSON.stringify(r));
    return r;
  };

  let { p, story } = reopen();
  saved(story, buy(2));
  const second = buy(3);
  saved(story, second);
  assert.deepEqual(truth(story.world()), [[true, true, false], 15, 25]);
  p.sql.close();

  ({ p, story } = reopen());
  assert.deepEqual(truth(story.world()), [[true, true, false], 15, 25]);
  const again = saved(story, second);
  if (again.kind === 'saved') assert.equal(again.replay, true);

  p.sql.exec(
    'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
  );
  p.fault.kind = 'failed';
  p.fault.armed = true;
  const third = buy(5);
  assert.equal(story.invoke(third).kind, 'pending');
  p.fault.reads = false;
  if (p.sql.isTransaction) p.sql.exec('ROLLBACK');
  p.sql.close();

  ({ p, story } = reopen());
  assert.deepEqual(truth(story.world()), [[true, true, false], 15, 25]);
  saved(story, third);
  p.sql.close();
  ({ p, story } = reopen());
  assert.deepEqual(truth(story.world()), [[true, true, true], 10, 30]);
  p.sql.close();
  coldReopen(path, bundle);
});

// Breaks: no receipt replay for a stock offer (the swap passes the shape check: the final custody
// matches and the stock items are not tracked by commerce custody; save.md B3 shop recovery).
test('a receipt naming another fish of the set is save_corrupt', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-prices-forged-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  {
    const path = join(dir, 'swap.db');
    const p = elapsedHost(path, undefined, bundle);
    const story = openStory(p.db, releases, p.host);
    if (story.kind !== 'open') throw new Error('not open');
    for (const [i, quoted_price] of [2, 3].entries())
      assert.equal(
        story.invoke({
          invocation_id: `bbbbbbbb-2121-4020-8020-${String(i + 1).padStart(12, '0')}`,
          actor_id: initial.character,
          action_key: 'buy',
          target_ids: [monger, fish('a')],
          input: { quoted_price },
        }).kind,
        'saved',
      );
    const rows = p.sql
      .prepare('SELECT invocation_id,response FROM receipt ORDER BY revision')
      .all();
    const swap = { [fish('a')]: fish('b'), [fish('b')]: fish('a') };
    for (const row of rows) {
      const text = Object.entries(swap).reduce(
        (s, [from, to]) => s.replaceAll(from, `@${to}`),
        row.response as string,
      );
      p.sql
        .prepare('UPDATE receipt SET response=? WHERE invocation_id=?')
        .run(text.replaceAll('@', ''), row.invocation_id as string);
    }
    p.sql.close();
    assert.throws(() => elapsedHost(path, undefined, bundle), /save_corrupt/);
  }
});

// Breaks: commerce custody tracks a stock offer's item (fish_a, moved by the trade job and not by a
// receipt), so cold reopen is save_corrupt.
test('a stock item the trade job moves back reopens', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-prices-trade-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'trade.db');
  let p = elapsedHost(path, undefined, bundle);
  const story = openStory(p.db, releases, p.host);
  if (story.kind !== 'open') throw new Error('not open');
  const fisher = initial.entityIds[`${S}:npc/fisher`]!;
  const invocations = [
    ['buy', [monger, fish('a')], { quoted_price: 2 }],
    ['buy', [monger, fish('a')], { quoted_price: 3 }],
    ['give', [fish('a'), fisher], {}],
    ['wait', [], { until: 28800 }],
  ] as const;
  for (const [i, [action_key, target_ids, input]] of invocations.entries()) {
    const r = story.invoke({
      invocation_id: `cccccccc-2121-4020-8020-${String(i + 1).padStart(12, '0')}`,
      actor_id: initial.character,
      action_key,
      target_ids: [...target_ids],
      input,
    });
    assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
  }
  assert.equal(story.world().state.containers[fish('a')], monger);
  p.sql.close();
  p = elapsedHost(path, undefined, bundle);
  const reopened = openStory(p.db, releases, p.host);
  assert.equal(reopened.kind, 'open', JSON.stringify(reopened));
  if (reopened.kind === 'open') assert.equal(reopened.world().state.containers[fish('a')], monger);
  p.sql.close();
});
