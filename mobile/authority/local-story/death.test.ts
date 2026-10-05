// Real adopted conformance sequence through the existing changed-row transaction and receipts.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  bundle,
  fresh,
  controlled,
  fatal,
  entity,
  room,
} from '../../../kernel/ts/test/death_fixture.ts';
import { identify, INTENT_DIGEST_VERSION } from '../../../kernel/ts/src/commands/invocation.ts';
import {
  gameView,
  newWorld,
  loadCartridge,
  INSTALLED,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { load, type Receipt } from './store.ts';
import { save, settle, scope, type Story } from './save.ts';
import { openStory } from './authority.ts';
import { invoke } from './invocation.ts';
import { ClockDriver } from './elapsed.ts';
import { readElapsed } from './elapsed-store.ts';

const releases = [{ fresh, content_hash: bundle.sha256 }] as const;
function setup(path = ':memory:') {
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const before = controlled();
  // Literal initial custody/resource/position input, before the operation under test.
  for (const [section, rows] of Object.entries(before.state)) {
    if (section === 'clock' || section === 'rng') continue;
    for (const [key, value] of Object.entries(rows))
      p.sql
        .prepare('INSERT OR REPLACE INTO state_row VALUES (?,?,?)')
        .run(section, key, JSON.stringify(value));
  }
  const saved = load(p.db, fresh, () => {
    throw new Error('existing save');
  });
  assert.ok(saved);
  const story: Story = {
    ...saved,
    db: p.db,
    fresh,
    releases,
    host: p.host,
    behind: false,
    elapsed: readElapsed(p.db, saved.meta.run_id, saved.world.state.clock)!,
  };
  const invocation = {
    invocation_id: '00000000-0000-4000-8000-000000000101',
    actor_id: fresh.character,
    action_key: 'look',
    target_ids: [],
    input: {},
  };
  const id = identify(scope(story), fresh.character, invocation);
  assert.equal(id.kind, 'identified');
  if (id.kind !== 'identified') throw new Error('conformance identity');
  const { next, sequence, command } = fatal(story.world, story.world.body, id.command_id);
  const receipt: Receipt = {
    scope: scope(story),
    invocation_id: invocation.invocation_id,
    command_id: id.command_id,
    actor_id: fresh.character,
    intent_digest_version: INTENT_DIGEST_VERSION,
    intent_digest: id.intent_digest,
    command: command as never,
    revision: 1,
    response: next.decision as never,
  };
  return { ...p, story, next, sequence, receipt, invocation };
}
const disk = (p: ReturnType<typeof setup>) =>
  ['state_row', 'head', 'receipt', 'elapsed'].map((table) =>
    p.sql.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all(),
  );

// Breaks: dynamic identity/custody omitted from commit/reopen or replay minting a second corpse.
test('corpse identity, worn roots and shrine return reopen atomically and receipt replay allocates nothing', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-death-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const p = setup(path),
    corpse = p.sequence.corpse_id;
  assert.equal(save(p.story, p.next, () => {}, [], p.receipt).kind, 'saved');
  const expected = p.story.world.state;
  p.sql.close();
  const reopened = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  t.after(() => reopened.sql.close());
  const story = openStory(reopened.db, releases, reopened.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') return;
  assert.equal(encode(story.world().state as never), encode(expected as never));
  assert.ok(story.world().entities[corpse]);
  assert.equal(story.world().state.containers[story.world().body], room(fresh, 'chapel_nave'));
  const before = reopened.sql.prepare('SELECT * FROM state_row').all();
  const replay = story.invoke(p.invocation);
  assert.equal(replay.kind, 'saved');
  if (replay.kind === 'saved') assert.equal(replay.replay, true);
  assert.deepEqual(reopened.sql.prepare('SELECT * FROM state_row').all(), before);
  assert.equal(Object.keys(story.world().state.created!).length, 1);
  assert.equal(story.world().state.containers[entity(fresh, 'item/wool_cloak')], corpse);
  // Walk-back mechanics remain ordinary; conformance places the same body at the death room.
  const returned = {
    ...story.world(),
    state: {
      ...story.world().state,
      containers: {
        ...story.world().state.containers,
        [fresh.body]: room(fresh, 'lantern_cellar'),
      },
    },
  };
  assert.ok(
    gameView(returned)
      .entities.find((e) => e.id === corpse)!
      .contents?.some((e) => e.id === entity(fresh, 'item/trunk')),
  );
});

// Breaks: an old bundled profile opens the new pin and silently ignores created rows.
test('an older release list refuses the corpse release without rewriting it', () => {
  const p = setup();
  try {
    assert.equal(save(p.story, p.next, () => {}, [], p.receipt).kind, 'saved');
    const prior = read('protocol/fixtures/containers_sampler_v007_hash.json');
    const loaded = loadCartridge(
      new TextEncoder().encode(
        JSON.stringify({ cartridge: prior.value, content_hash: prior.sha256 }),
      ),
      INSTALLED,
    );
    assert.ok(loaded.ok);
    const old = newWorld(loaded.cartridge as Cartridge, fresh.context, [1, 2, 3, 4]);
    const before = disk(p);
    assert.equal(
      openStory(p.db, [{ fresh: old, content_hash: prior.sha256 }], p.host).kind,
      'pinned_release_missing',
    );
    assert.deepEqual(disk(p), before);
  } finally {
    p.sql.close();
  }
});

// Breaks: a failed/uncertain commit exposes corpse loot or shrine movement before all rows commit.
test('real FULL, failed COMMIT and committed-unknown COMMIT preserve all prior or all next corpse rows', () => {
  for (const kind of ['full', 'failed', 'lost'] as const) {
    const p = setup();
    try {
      const before = disk(p),
        oldWorld = p.story.world;
      if (kind === 'full') {
        p.sql.exec(`PRAGMA max_page_count=${p.sql.prepare('PRAGMA page_count').get()!.page_count}`);
        assert.throws(
          () =>
            save(p.story, p.next, () => {}, [], {
              ...p.receipt,
              command: { ...(p.receipt.command as object), padding: 'x'.repeat(20000) },
            }),
          { errcode: 13 },
        );
        assert.deepEqual(disk(p), before);
        assert.equal(p.story.world, oldWorld);
      } else {
        if (kind === 'failed')
          p.sql.exec(
            'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
          );
        p.fault.kind = kind;
        p.fault.armed = true;
        assert.equal(save(p.story, p.next, () => {}, [], p.receipt).kind, 'pending');
        assert.equal(p.story.world, oldWorld);
        assert.equal(invoke(p.story, p.invocation).kind, 'pending');
        const driver = new ClockDriver(p.story, p.host.time!, () => {});
        p.clock.mono = 1000;
        assert.equal(driver.pulse('active', p.story.meta.run_id).kind, 'pending');
        assert.equal(p.story.world.state.created, undefined);
        p.fault.reads = false;
        assert.equal(!!settle(p.story), kind === 'lost');
        if (kind === 'failed') assert.deepEqual(disk(p), before);
        assert.equal(
          encode(p.story.world.state as never),
          encode((kind === 'lost' ? p.next.world.state : oldWorld.state) as never),
        );
        assert.equal(!!p.story.world.entities[p.sequence.corpse_id], kind === 'lost');
      }
      const reopened = load(p.db, fresh, () => {
        throw new Error('existing save');
      });
      assert.ok(reopened);
      assert.equal(
        encode(reopened.world.state as never),
        encode((kind === 'lost' ? p.next.world.state : oldWorld.state) as never),
      );
    } finally {
      p.sql.close();
    }
  }
});

// Breaks: malformed dynamic rows reopen as valid while losing or leaking possessions.
test('save load refuses missing identity, unknown template and illegal corpse custody without repair', () => {
  for (const corrupt of ['identity', 'template', 'owner', 'placement'] as const) {
    const p = setup();
    try {
      assert.equal(save(p.story, p.next, () => {}, [], p.receipt).kind, 'saved');
      const id = p.sequence.corpse_id;
      if (corrupt === 'identity')
        p.sql.prepare('DELETE FROM state_row WHERE section=? AND key=?').run('created', id);
      else if (corrupt === 'placement')
        p.sql.prepare('DELETE FROM state_row WHERE section=? AND key=?').run('containers', id);
      else {
        const value = JSON.parse(
          p.sql.prepare('SELECT value FROM state_row WHERE section=? AND key=?').get('created', id)!
            .value as string,
        );
        if (corrupt === 'template') value.definition.key = 'missing';
        else value.origin.owner_id = null;
        p.sql
          .prepare('UPDATE state_row SET value=? WHERE section=? AND key=?')
          .run(JSON.stringify(value), 'created', id);
      }
      const before = disk(p);
      assert.equal(openStory(p.db, releases, p.host).kind, 'save_corrupt');
      assert.deepEqual(disk(p), before);
    } finally {
      p.sql.close();
    }
  }
});
