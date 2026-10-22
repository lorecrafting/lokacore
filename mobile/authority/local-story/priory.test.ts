import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { read } from '../../../kernel/ts/test/read.ts';
import { encode, hash } from '../../../kernel/ts/src/foundation/canonical.ts';
import { loadCartridge, INSTALLED, newWorld } from '../../../kernel/ts/src/index.ts';
import { chestBundle, CONTEXT, ids as idsOf } from './__tests__/priory-fixture.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';
import { presenter } from '../../app/book/presenter.ts';
import { restoredItemPages } from '../../app/book/model.ts';

const ids = idsOf(chestBundle().value),
  LEDGER = 'The mill ground more sacks at night than by day.';

function setup(
  path = ':memory:',
  source: { value: any; canonical: string; sha256: string } = chestBundle(),
) {
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, source),
    book = presenter(a.game);
  a.game.subscribe(book.update);
  const view = () => a.game.view().view;
  const ok = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    const reply = a.game.invoke({ action_key, target_ids, input } as never);
    assert.equal(reply.kind, 'saved', JSON.stringify(reply));
    if (reply.kind === 'saved')
      assert.equal(reply.decision.kind, 'accepted', JSON.stringify(reply));
    return reply;
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => ok('move', [], { direction }));
  const toBooks = () => move('west');
  const read = () =>
    book.press(
      book
        .screen()
        .buttons.find((b) => b.command === 'read' && b.target_ids[0] === ids['item/mill_ledger']) ??
        assert.fail('Read ledger'),
      ids['item/mill_ledger'],
    );
  const loaded = loadCartridge(
    new TextEncoder().encode(encode({ cartridge: source.value, content_hash: source.sha256 })),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  const world = newWorld(loaded.cartridge as never, CONTEXT as never, [1, 2, 3, 4]);
  const reopen = () => openStory(a.db, [{ fresh: world, content_hash: source.sha256 }], a.host);
  return { ...a, book, view, ok, move, toBooks, read, reopen };
}

// Break: legal intermediate custody, closure or travel invalidates the historical Read grant on reopen.
test('real SQLite preserves original books through ground Take nested open Read closure travel and reread', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d2-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'story.db');
  const controlled = chestBundle();
  let a = setup(path, controlled);
  const ward = ids['item/mill_ledger'],
    bell = ids['item/carters_note'],
    chest = ids['item/chest'];
  const reopen = () => {
    a.sql.close();
    a = setup(path, controlled);
    assert.equal(a.reopen().kind, 'open');
  };
  a.toBooks();
  reopen();
  a.ok('take', [ward]);
  reopen();
  a.ok('take', [chest]);
  a.ok('put', [ward, chest]);
  reopen();
  a.read();
  assert.deepEqual(
    a.view().topics?.map((t) => t.topic.key),
    ['mill'],
  );
  reopen();
  assert.deepEqual(restoredItemPages(a.view(), a.book.screen().detail), [
    { kind: 'carrying' },
    { kind: 'thing', id: chest },
    { kind: 'thing', id: ward },
  ]);
  assert.deepEqual(a.book.screen().detail(ward), [LEDGER]);
  a.ok('close', [chest]);
  reopen();
  assert.deepEqual(restoredItemPages(a.view(), a.book.screen().detail), []);
  a.ok('open', [chest]);
  a.read();
  a.move('east', 'south');
  a.ok('take', [bell]);
  a.ok('read', [bell]);
  reopen();
  assert.deepEqual(
    a.view().topics?.map((t) => t.topic.key),
    ['mill', 'missing_cart'],
  );
  a.move('north');
  reopen();
  a.ok('take', [ward]);
  a.ok('drop', [ward]);
  reopen();
  assert.deepEqual(
    a.view().topics?.map((t) => t.topic.key),
    ['mill', 'missing_cart'],
  );
  a.ok('take', [ward]);
  a.read();
  assert.equal(a.reopen().kind, 'open');
  a.sql.close();
});

// Break: first/already-known Read partially commits or exact retry duplicates narration/grant.
test('real failed and lost COMMIT outcomes fence Read then retry and replay once', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d2-faults-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const kind of ['failed', 'lost'] as const)
    for (const known of [false, true]) {
      const a = setup(join(dir, `${kind}-${known}.db`));
      assert.equal(a.sql.prepare('PRAGMA journal_mode').get()!.journal_mode, 'delete');
      a.toBooks();
      a.ok('take', [ids['item/mill_ledger']]);
      if (known) a.read();
      const before = a.view().topics;
      a.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
      a.fault.kind = kind;
      a.fault.armed = true;
      a.read();
      assert.equal(a.game.pending(), true);
      const invocation = a.game.pendingInvocation();
      assert.ok(invocation);
      assert.deepEqual(a.view().topics, before);
      a.fault.reads = false;
      a.read();
      assert.equal(a.game.pending(), false);
      assert.deepEqual(
        a.view().topics?.map((t) => t.topic.key),
        ['mill'],
      );
      const detail = a.book.screen().detail(ids['item/mill_ledger']);
      assert.equal(detail.length, known ? 2 : 1);
      const actor = a.view().actor_id;
      const reopened = a.reopen();
      assert.equal(reopened.kind, 'open');
      if (reopened.kind !== 'open') assert.fail('reopen');
      const replay = reopened.invoke({
        invocation_id: invocation,
        actor_id: actor,
        action_key: 'read',
        target_ids: [ids['item/mill_ledger']],
        input: {},
      } as never);
      assert.equal(replay.kind, 'saved');
      if (replay.kind === 'saved') assert.equal(replay.replay, true);
      assert.equal(
        a.sql.prepare('SELECT count(*) AS n FROM receipt WHERE invocation_id=?').get(invocation!)!
          .n,
        1,
      );
      assert.equal(a.reopen().kind, 'open');
      assert.equal(a.view().actor_id, actor);
      a.sql.close();
    }
});

// Break: forged Read identity/topic/cause or omitted lawful grant is accepted from today's knowledge rows.
test('historical Read and known-topic truth reject wrong actor book definition cause missing grants and closed custody', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d2-corrupt-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const mutations = [
    (c: any, d: any) => {
      c.payload.actor_id = ids.body;
    },
    (c: any, d: any) => {
      c.payload.target_id = ids['item/carters_note'];
    },
    (c: any, d: any) => {
      d.delta.ops[0].fact.cartridge_version = '0.0.2';
    },
    (c: any, d: any) => {
      d.events[0].causation_id = 'aaaaaaaa-0000-4000-8000-000000000099';
    },
    (c: any, d: any) => {
      d.delta.ops = [];
      d.events = [];
    },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const path = join(dir, `${index}.db`);
    const a = setup(path);
    a.toBooks();
    a.ok('take', [ids['item/mill_ledger']]);
    a.read();
    const row = a.sql
      .prepare(
        "SELECT command_id,command,response FROM receipt WHERE json_extract(command,'$.payload.type')='read' ORDER BY revision DESC LIMIT 1",
      )
      .get()!;
    const c = JSON.parse(row.command as string),
      d = JSON.parse(row.response as string);
    mutate(c, d);
    a.sql
      .prepare('UPDATE receipt SET command=?,response=? WHERE command_id=?')
      .run(JSON.stringify(c), JSON.stringify(d), row.command_id as string);
    const before = a.sql.prepare('SELECT value FROM state_row ORDER BY section,key').all();
    const bytes = readFileSync(path);
    assert.equal(a.reopen().kind, 'save_corrupt');
    assert.deepEqual(readFileSync(path), bytes);
    assert.deepEqual(
      a.sql.prepare('SELECT value FROM state_row ORDER BY section,key').all(),
      before,
    );
    a.sql.close();
  }
});

// Break: a Book remount reads the uncertain receipt before reconciliation, then loses its exact detail routing.
test('Book remount during lost Read acknowledgement waits for confirmation then routes its one recovered page', () => {
  const a = setup();
  a.toBooks();
  a.ok('take', [ids['item/mill_ledger']]);
  a.fault.kind = 'lost';
  a.fault.armed = true;
  a.read();
  assert.equal(a.game.pending(), true);
  const remounted = presenter(a.game);
  a.game.subscribe(remounted.update);
  assert.deepEqual(remounted.screen().detail(ids['item/mill_ledger']), []);
  assert.deepEqual(remounted.screen().view.topics, []);
  a.fault.reads = false;
  assert.equal(a.game.pulse('active').kind, 'ready');
  assert.deepEqual(remounted.screen().detail(ids['item/mill_ledger']), [LEDGER]);
  assert.deepEqual(remounted.screen().log, []);
  assert.deepEqual(
    remounted.screen().view.topics?.map((t) => t.topic.key),
    ['mill'],
  );
  assert.equal(a.reopen().kind, 'open');
  a.sql.close();
});

// Break: readable-only cartridges skip historical replay and accept forged Read narration.
test('readable-only SQLite recovery rejects forged narration without another history consumer', (t) => {
  const c = structuredClone(read('protocol/fixtures/cartridge_items_hash.json').value);
  c.manifest.requires.kernel_api.at_least = '1.24';
  c.manifest.requires.capabilities.readable = c.lock.capabilities.readable = 1;
  c.items['items_sampler@0.0.1:item/satchel'].container = true;
  c.items['items_sampler@0.0.1:item/lantern'].readable = {
    label: 'item.lantern.short',
    text: 'item.lantern.description',
  };
  const dir = mkdtempSync(join(tmpdir(), 'loka-d2-readable-only-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'story.db');
  const a = setup(path, { value: c, canonical: encode(c), sha256: hash(c) });
  t.after(() => a.sql.close());
  a.move('north');
  const book = a.view().entities.find((e) => e.kind === 'item' && e.name === 'item.lantern.short');
  assert.ok(book);
  a.ok('take', [book.id]);
  a.ok('read', [book.id]);
  assert.equal(a.reopen().kind, 'open');
  const row = a.sql
    .prepare(
      "SELECT command_id,response FROM receipt WHERE json_extract(command,'$.payload.type')='read'",
    )
    .get()!;
  const response = JSON.parse(row.response as string);
  response.narration[0].key = 'room.ferry_landing.description';
  a.sql
    .prepare('UPDATE receipt SET response=? WHERE command_id=?')
    .run(JSON.stringify(response), row.command_id as string);
  const before = readFileSync(path);
  assert.equal(a.reopen().kind, 'save_corrupt');
  assert.deepEqual(readFileSync(path), before);
});
