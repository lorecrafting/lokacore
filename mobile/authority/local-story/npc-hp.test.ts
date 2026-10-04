// Prerequisite conformance: an admitted adjustment, no authored attack/damage verb.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { accepted } from '../../../kernel/ts/src/runtime/decision.ts';
import { admit, adopt } from '../../../kernel/ts/src/runtime/proposal.ts';
import {
  adjust,
  level,
  resourceRef,
  resourceSpec,
} from '../../../kernel/ts/src/mechanics/resource.ts';
import { identify, INTENT_DIGEST_VERSION } from '../../../kernel/ts/src/commands/invocation.ts';
import { key } from '../../../kernel/ts/src/foundation/compose.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { load, type Receipt } from './store.ts';
import { save, settle, scope, type Story } from './save.ts';
import { openStory } from './authority.ts';

const kat = read('protocol/fixtures/cartridge_sampler_hash.json');
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok);
const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
const releases = [{ fresh, content_hash: kat.sha256 }] as const;
const hp = resourceRef(fresh, 'hp');
const rat = fresh.entityIds['ashmere_sampler@0.0.7:npc/cellar_rat_1'];
const rat2 = fresh.entityIds['ashmere_sampler@0.0.7:npc/cellar_rat_2'];
const target = key({ kind: 'resource', resource: hp, entity_id: rat });
const disk = (p: ReturnType<typeof elapsedHost>) => ({
  rows: p.sql.prepare('SELECT section,key,value FROM state_row ORDER BY section,key').all(),
  head: p.sql.prepare('SELECT * FROM head').get(),
  receipts: p.sql.prepare('SELECT * FROM receipt').all(),
});
const setup = (path = ':memory:') => {
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, kat);
  const saved = load(p.db, fresh, () => {
    throw new Error('existing save required');
  });
  assert.ok(saved);
  const story: Story = {
    ...saved,
    db: p.db,
    fresh,
    releases: [...releases],
    host: p.host,
    behind: false,
  };
  // The ordinary look invocation supplies receipt identity only. The admitted resource decision
  // below is conformance input; the shipped look rule never produces this adjustment.
  const invocation = {
    invocation_id: 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b',
    actor_id: fresh.character,
    action_key: 'look',
    target_ids: [],
    input: {},
  };
  const id = identify(scope(story), fresh.character, invocation);
  assert.equal(id.kind, 'identified');
  if (id.kind !== 'identified') throw new Error('invalid conformance identity');
  const command = {
    id: id.command_id,
    payload: { type: 'look', actor_id: fresh.character },
  } as const;
  const next = adopt(
    story.world,
    admit(
      'resource',
      accepted(story.world, 'adjusted', [adjust(story.world, rat, hp, -1, {}).op], []),
    ),
    command as never,
    () => {
      throw new Error('unexpected allocation');
    },
    1,
  );
  assert.equal(next.decision.kind, 'accepted');
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
  return { ...p, story, next, receipt, invocation };
};

// Breaks: a committed NPC row is omitted, reopen loses its pinned override, or receipt replay spends twice.
test('actual adopted rat adjustment commits, reopens pinned HP and replays without another write', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-npc-hp-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const p = setup(path);
  assert.equal(save(p.story, p.next, () => {}, [], p.receipt).kind, 'saved');
  assert.equal(level(p.story.world, rat, hp), 5);
  p.sql.close();
  const reopened = elapsedHost(path, { wall: 10000, mono: 0 }, kat);
  try {
    const story = openStory(reopened.db, [...releases], reopened.host);
    assert.equal(story.kind, 'open');
    if (story.kind !== 'open') return;
    const w = story.world();
    assert.deepEqual([level(w, rat, hp), level(w, rat2, hp), level(w, w.body, hp)], [5, 6, 10]);
    assert.deepEqual(
      [
        resourceSpec(w, rat, hp).maximum,
        resourceSpec(w, rat2, hp).maximum,
        resourceSpec(w, w.body, hp).maximum,
      ],
      [6, 6, 10],
    );
    assert.equal(level({ ...w, state: { ...w.state, clock: 68400 } }, rat, hp), 5);
    const before = disk(reopened);
    const replay = story.invoke(p.invocation);
    assert.equal(replay.kind, 'saved');
    if (replay.kind === 'saved') assert.equal(replay.replay, true);
    assert.deepEqual(disk(reopened), before);
  } finally {
    reopened.sql.close();
  }
});

// Breaks: required HP rows silently heal on load, or use player bounds/position metadata.
test('reopen rejects missing, malformed, or out-of-bounds NPC HP without rewriting progress', () => {
  const p = setup();
  try {
    for (const row of [
      null,
      { value: 7, at: 64800 },
      { value: 6, at: 68401 },
      { value: 6, at: true },
      { value: 6, at: 0.5 },
      { value: 6, at: 9007199254740992 },
      { value: 6, at: 64800, rate: 0 },
    ]) {
      p.sql.prepare("DELETE FROM state_row WHERE section='resources' AND key=?").run(target);
      if (row !== null)
        p.sql
          .prepare('INSERT INTO state_row VALUES (?, ?, ?)')
          .run('resources', target, JSON.stringify(row));
      const before = disk(p);
      assert.equal(openStory(p.db, [...releases], p.host).kind, 'save_corrupt');
      assert.deepEqual(disk(p), before);
    }
  } finally {
    p.sql.close();
  }
});

// Breaks: real write/COMMIT faults adopt a rat row without its head/receipt, or reconcile without its effective map.
test('SQLite FULL, failed COMMIT and lost acknowledgement preserve atomic NPC HP adoption', () => {
  for (const kind of ['full', 'failed', 'lost'] as const) {
    const p = setup();
    try {
      const before = disk(p);
      if (kind === 'full') {
        p.sql.exec(`PRAGMA max_page_count=${p.sql.prepare('PRAGMA page_count').get()!.page_count}`);
        // Force real page growth in the existing receipt transaction, after the HP write.
        assert.throws(
          () =>
            save(p.story, p.next, () => {}, [], {
              ...p.receipt,
              command: { ...(p.receipt.command as object), padding: 'x'.repeat(20000) },
            }),
          { errcode: 13 },
        );
        assert.deepEqual(disk(p), before);
      } else {
        if (kind === 'failed')
          p.sql.exec(
            'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
          );
        p.fault.kind = kind;
        p.fault.armed = true;
        assert.equal(save(p.story, p.next, () => {}, [], p.receipt).kind, 'pending');
        assert.equal(level(p.story.world, rat, hp), 6);
        assert.throws(() => settle(p.story));
        p.fault.reads = false;
        if (kind === 'failed') assert.deepEqual(disk(p), before);
        assert.equal(!!settle(p.story), kind === 'lost');
        assert.equal(level(p.story.world, rat, hp), kind === 'lost' ? 5 : 6);
        assert.equal(resourceSpec(p.story.world, rat, hp).maximum, 6);
      }
    } finally {
      p.sql.close();
    }
  }
});
