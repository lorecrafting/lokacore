import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { bundle, fresh, rat, room, ref } from '../../../kernel/ts/test/combat_fixture.ts';
import type { DefinitionRef } from '../../../kernel/ts/src/contracts.gen.ts';
import { gameView } from '../../../kernel/ts/src/index.ts';
import { key } from '../../../kernel/ts/src/foundation/compose.ts';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { level, resourceRef } from '../../../kernel/ts/src/mechanics/resource.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { engaged } from '../../../kernel/ts/src/mechanics/combat/shared.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { load } from './store.ts';

const releases = [{ fresh, content_hash: bundle.sha256 }] as const;
function setup(path = ':memory:', lethal: 'rat' | 'player' | undefined = undefined) {
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const write = (section: string, id: string, v: unknown) =>
    p.sql
      .prepare('INSERT OR REPLACE INTO state_row VALUES (?,?,?)')
      .run(section, id, JSON.stringify(v));
  write('containers', fresh.body, room(fresh, 'lantern_cellar'));
  if (lethal)
    write(
      'resources',
      key({
        kind: 'resource',
        resource: resourceRef(fresh, 'hp'),
        entity_id: lethal === 'rat' ? rat(fresh, 3) : fresh.body,
      }),
      { value: 1, at: 64800 },
    );
  const story = openStory(p.db, releases, p.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') throw new Error('test setup');
  let n = 0;
  const invocation = (action_key: string, target_ids: string[] = [], input: object = {}) => ({
    invocation_id: `bbbbbbbb-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    actor_id: fresh.character,
    action_key,
    target_ids,
    input,
  });
  return { ...p, story, invocation, write };
}
const disk = (p: ReturnType<typeof setup>) =>
  ['state_row', 'head', 'receipt', 'elapsed'].map((t) =>
    p.sql.prepare(`SELECT * FROM ${t} ORDER BY 1,2`).all(),
  );
const pool = (p: ReturnType<typeof setup>, name: string) =>
  level(p.story.world(), fresh.body, resourceRef(fresh, name));

// Breaks: current job/initiative or RNG dropped by save, so reopening repeats or changes the next round.
test('real SQLite reopens Attack and both M4 A rounds with original receipt replay', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'loka-combat-'));
  t.after(() => rmSync(directory, { recursive: true }));
  const path = join(directory, 'save.db');
  const p = setup(path);
  const attack = p.invocation('attack', [rat(fresh)]);
  assert.equal(p.story.invoke(attack).kind, 'saved');
  const evidence = { expected_run_id: p.story.runId(), from: 64800, until: 64950 };
  p.sql.close();
  const q = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const reopened = openStory(q.db, releases, q.host);
  assert.equal(reopened.kind, 'open');
  if (reopened.kind !== 'open') return;
  assert.deepEqual(
    gameView(reopened.world())
      .actions.filter((a) => a.available)
      .map((a) => a.action_key),
    ['flee', 'look', 'scan'],
  );
  assert.equal(reopened.elapsed(evidence).kind, 'saved');
  assert.deepEqual(reopened.world().state.rng, [25179138, 12295, 540162, 2107404]);
  assert.equal(level(reopened.world(), fresh.body, resourceRef(fresh, 'hp')), 9);
  const first = encode(reopened.world().state as never);
  assert.deepEqual(reopened.elapsed(evidence).kind, 'saved');
  assert.equal(encode(reopened.world().state as never), first);
  q.sql.close();
  const r = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  t.after(() => r.sql.close());
  const again = openStory(r.db, releases, r.host);
  assert.equal(again.kind, 'open');
  if (again.kind !== 'open') return;
  assert.equal(again.elapsed({ ...evidence, from: 64950, until: 65100 }).kind, 'saved');
  assert.deepEqual(again.world().state.rng, [15224335, 29364750, 272377353, 1125134346]);
  assert.equal(level(again.world(), fresh.body, resourceRef(fresh, 'hp')), 8);
  const beforeReplay = encode(again.world().state as never);
  const replay = again.invoke(attack);
  assert.equal(replay.kind, 'saved');
  if (replay.kind === 'saved') assert.equal(replay.replay, true);
  assert.equal(encode(again.world().state as never), beforeReplay);
});

// Breaks: the fatal receipt omits credit/identity, or replay delivers the death mapper twice.
test('a real rat kill commits corpse and preacceptance credit together and reopens exactly', () => {
  const p = setup(':memory:', 'rat');
  try {
    assert.equal(p.story.invoke(p.invocation('attack', [rat(fresh, 3)])).kind, 'saved');
    const evidence = { expected_run_id: p.story.runId(), from: 64800, until: 64950 };
    assert.equal(p.story.elapsed(evidence).kind, 'saved');
    const w = p.story.world();
    assert.deepEqual(
      w.cartridge.world!.death_credit!.map((m) => value(w, w.character, m.fact)),
      [false, false, true, false, false],
    );
    assert.equal(Object.keys(w.state.created!).length, 1);
    assert.equal(Object.keys(w.state.quests ?? {}).length, 0);
    const before = disk(p);
    const replay = p.story.elapsed(evidence);
    assert.equal(replay.kind, 'saved');
    if (replay.kind === 'saved') assert.equal(replay.replay, true);
    assert.deepEqual(disk(p), before);
    const saved = load(p.db, fresh, () => {
      throw new Error('existing');
    });
    assert.ok(saved);
    assert.equal(encode(saved.world.state as never), encode(w.state as never));
  } finally {
    p.sql.close();
  }
});

// Breaks: same-body return strands recovery behind a keyed passage or loses worn/nested roots.
test('actual lethal combat returns empty-handed and ordinary six-exit journey recovers corpse roots', () => {
  const p = setup(':memory:', 'player');
  try {
    const bag = fresh.entityIds[ref(fresh, 'item', 'trunk')];
    const lantern = fresh.entityIds[ref(fresh, 'item', 'lantern')];
    const cloak = fresh.entityIds[ref(fresh, 'item', 'wool_cloak')];
    p.write('containers', bag, fresh.body);
    p.write('containers', lantern, bag);
    p.write('containers', cloak, fresh.slots.cloak);
    p.write(
      'resources',
      key({ kind: 'resource', resource: resourceRef(fresh, 'ma'), entity_id: fresh.body }),
      { value: 7, at: 64800 },
    );
    const plan = {
      cartridge_id: 'ashmere_sampler',
      cartridge_version: '0.0.9',
      kind: 'fact',
      key: 'search_plan',
    } as DefinitionRef;
    p.write(
      'facts',
      key({ kind: 'fact', fact: plan, scope: { kind: 'player', character_id: fresh.character } }),
      'player_led',
    );
    const loaded = openStory(p.db, releases, p.host);
    assert.equal(loaded.kind, 'open');
    if (loaded.kind !== 'open') return;
    assert.equal(loaded.invoke(p.invocation('attack', [rat(fresh)])).kind, 'saved');
    assert.equal(
      loaded.elapsed({ expected_run_id: loaded.runId(), from: 64800, until: 64950 }).kind,
      'saved',
    );
    const corpse = Object.keys(loaded.world().state.created!)[0];
    assert.deepEqual(
      [
        loaded.world().state.containers[bag],
        loaded.world().state.containers[cloak],
        loaded.world().state.containers[lantern],
      ],
      [corpse, corpse, bag],
    );
    assert.equal(loaded.world().state.containers[fresh.body], room(fresh, 'chapel_nave'));
    assert.equal(engaged(loaded.world(), fresh.body), undefined);
    assert.equal(level(loaded.world(), fresh.body, resourceRef(fresh, 'ma')), 7);
    assert.equal(value(loaded.world(), fresh.character, plan), 'player_led');
    assert.equal(loaded.world().character, fresh.character);
    assert.equal(loaded.world().body, fresh.body);
    const walk = (directions: string[]) => {
      for (const direction of directions) {
        const result = loaded.invoke(p.invocation('move', [], { direction }));
        assert.equal(result.kind, 'saved');
        if (result.kind === 'saved')
          assert.equal(
            (result.decision as { kind: string }).kind,
            'accepted',
            JSON.stringify(result),
          );
      }
    };
    walk(['south', 'south', 'south', 'south', 'east', 'down']);
    assert.equal(loaded.world().state.containers[fresh.body], room(fresh, 'lantern_cellar'));
    assert.equal(level(loaded.world(), fresh.body, resourceRef(fresh, 'mv')), 94);
    assert.equal(loaded.invoke(p.invocation('take', [bag])).kind, 'saved');
    assert.equal(loaded.world().state.containers[bag], fresh.body);
    const heavy = loaded.invoke(p.invocation('take', [cloak]));
    assert.equal(heavy.kind, 'saved');
    if (heavy.kind === 'saved')
      assert.deepEqual(heavy.decision, { kind: 'rejected', error: { code: 'too_heavy' } });
    walk(['up', 'west', 'north', 'north', 'north', 'north']);
    loaded.invoke(p.invocation('drop', [bag]));
    walk(['south', 'south', 'south', 'south', 'east', 'down']);
    loaded.invoke(p.invocation('take', [cloak]));
    assert.equal(loaded.world().state.containers[cloak], fresh.body);
    assert.equal(loaded.world().state.containers[bag], room(fresh, 'chapel_nave'));
    assert.equal(loaded.world().state.containers[lantern], bag);
  } finally {
    p.sql.close();
  }
});

// Breaks: due-job fatal rows partially commit or uncertain COMMIT exposes them before reconciliation.
test('genuine FULL and both unknown-COMMIT outcomes fence a real fatal round', () => {
  for (const kind of ['full', 'failed', 'lost'] as const) {
    const p = setup(':memory:', 'rat');
    try {
      p.story.invoke(p.invocation('attack', [rat(fresh, 3)]));
      const before = disk(p),
        old = p.story.world();
      const evidence = { expected_run_id: p.story.runId(), from: 64800, until: 64950 };
      if (kind === 'full') {
        p.sql.exec(`PRAGMA max_page_count=${p.sql.prepare('PRAGMA page_count').get()!.page_count}`);
        assert.throws(() => p.story.elapsed(evidence), { errcode: 13 });
        assert.deepEqual(disk(p), before);
        assert.equal(p.story.world(), old);
      } else {
        if (kind === 'failed')
          p.sql.exec(
            'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
          );
        p.fault.kind = kind;
        p.fault.armed = true;
        assert.equal(p.story.elapsed(evidence).kind, 'pending');
        assert.equal(p.story.world(), old);
        assert.equal(p.story.invoke(p.invocation('look')).kind, 'pending');
        p.clock.mono = 1000;
        assert.equal(p.story.pulse('active', p.story.runId()).kind, 'pending');
        p.fault.reads = false;
        const durable = load(p.db, fresh, () => {
          throw new Error('existing');
        });
        assert.ok(durable);
        if (kind === 'failed') {
          assert.deepEqual(disk(p), before);
          assert.equal(encode(durable.world.state as never), encode(old.state as never));
        } else {
          assert.equal(Object.keys(durable.world.state.created!).length, 1);
          assert.deepEqual(
            durable.world.cartridge.world!.death_credit!.map((m) =>
              value(durable.world, fresh.character, m.fact),
            ),
            [false, false, true, false, false],
          );
          assert.equal(engaged(durable.world, fresh.body), undefined);
          assert.deepEqual(durable.world.state.rng, [12295, 1029, 1029, 25165824]);
        }
        const retried = p.story.elapsed(evidence);
        assert.equal(retried.kind, 'saved');
        assert.equal(Object.keys(p.story.world().state.created!).length, 1);
        if (retried.kind === 'saved') assert.equal(retried.replay, kind === 'lost');
      }
    } finally {
      p.sql.close();
    }
  }
});

// Breaks: corrupt participant/binding rows silently resume a different fight after load.
test('saved encounter corruption refuses before exposing play without repairing rows', () => {
  for (const field of ['body_id', 'job_id', 'round'] as const) {
    const p = setup();
    try {
      p.story.invoke(p.invocation('attack', [rat(fresh)]));
      const fight = engaged(p.story.world(), fresh.body)!;
      const row = { ...fight.row, [field]: field === 'round' ? 0 : rat(fresh, 2) };
      p.write('encounters', fight.id, row);
      const before = disk(p);
      assert.equal(
        load(p.db, fresh, () => {
          throw new Error('existing');
        }),
        undefined,
      );
      assert.deepEqual(disk(p), before);
    } finally {
      p.sql.close();
    }
  }
});

// Breaks: an input arriving at the lethal deadline escapes before authoritative due work.
test('input at the due deadline settles lethal combat before attempting Flee', () => {
  const p = setup(':memory:', 'player');
  try {
    assert.equal(p.story.invoke(p.invocation('attack', [rat(fresh)])).kind, 'saved');
    p.clock.mono = 3000;
    p.clock.wall = 13000;
    const result = p.story.invoke(p.invocation('flee'));
    assert.equal(result.kind, 'saved');
    if (result.kind === 'saved')
      assert.deepEqual(result.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
    assert.equal(p.story.world().state.clock, 64950);
    assert.equal(p.story.world().state.containers[fresh.body], room(fresh, 'chapel_nave'));
    assert.equal(Object.keys(p.story.world().state.created!).length, 1);
    assert.equal(pool(p, 'hp'), 10);
    assert.equal(pool(p, 'mv'), 100);
  } finally {
    p.sql.close();
  }
});

// Breaks: retrying a random escape chooses again or persists destination without its RNG.
test('random Flee destination and RNG reopen and replay one SQLite receipt', () => {
  const p = setup();
  try {
    const inn = room(fresh, 'drowned_lantern');
    p.write('containers', fresh.body, inn);
    p.write('containers', rat(fresh), inn);
    const story = openStory(p.db, releases, p.host);
    assert.equal(story.kind, 'open');
    if (story.kind !== 'open') return;
    assert.equal(story.invoke(p.invocation('attack', [rat(fresh)])).kind, 'saved');
    const invocation = p.invocation('flee');
    const first = story.invoke(invocation);
    assert.equal(first.kind, 'saved');
    assert.equal(story.world().state.containers[fresh.body], room(fresh, 'lantern_cellar'));
    assert.deepEqual(story.world().state.rng, [7, 0, 1026, 12288]);
    assert.equal(level(story.world(), fresh.body, resourceRef(fresh, 'mv')), 98);
    const committed = encode(story.world().state as never);
    const reopened = openStory(p.db, releases, p.host);
    assert.equal(reopened.kind, 'open');
    if (reopened.kind !== 'open') return;
    const replay = reopened.invoke(invocation);
    assert.equal(replay.kind, 'saved');
    if (replay.kind === 'saved') assert.equal(replay.replay, true);
    assert.equal(encode(reopened.world().state as never), committed);
    if (first.kind === 'saved' && replay.kind === 'saved')
      assert.equal(encode(replay.decision as never), encode(first.decision as never));
  } finally {
    p.sql.close();
  }
});
