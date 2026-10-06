import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadCartridge,
  newWorld,
  gameView,
  INSTALLED,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';

function chapter(path: string) {
  const bundle = read('protocol/fixtures/missing_child_v038_hash.json');
  const loaded = loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
    ),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const fresh = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const host = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const releases = [{ fresh, content_hash: bundle.sha256 }] as const;
  const open = () => {
    const result = openStory(host.db, releases, host.host);
    assert.equal(result.kind, 'open', JSON.stringify(result));
    if (result.kind !== 'open') throw new Error('save did not open');
    return result;
  };
  return { ...host, fresh, open };
}

// Breaks: creation commits an ancestry without all six values, inherited skill/faction, or matching receipt; cold reopen loses the once-only choice.
test('fen choice commits one creation receipt and reopens inherited state', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'd11-choice-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const a = chapter(join(dir, 'save.db'));
  t.after(() => a.sql.close());
  let story = a.open();
  const choice = {
    invocation_id: 'dddddddd-0000-4000-8000-000000000001',
    actor_id: a.fresh.character,
    action_key: 'choose_ancestry',
    target_ids: [],
    input: { ancestry: 'fen_born' },
  };
  assert.deepEqual(
    gameView(story.world()).ancestry_choices?.map((c) => c.key),
    ['fen_born', 'road_born', 'hill_folk', 'fey_touched'],
  );
  const result = story.invoke(choice);
  assert.equal(result.kind, 'saved');
  if (result.kind === 'saved') assert.equal((result.decision as { kind: string }).kind, 'accepted');
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, 1);
  story = a.open();
  assert.equal(gameView(story.world()).ancestry, 'fen_born');
  assert.deepEqual(
    Object.values(story.world().state.characters![a.fresh.character].attributes).sort(
      (x, y) => x - y,
    ),
    [6, 10, 10, 10, 10, 10],
  );
  assert.equal(gameView(story.world()).skills?.find((s) => s.skill.key === 'swim')?.acquired, true);
  const replay = story.invoke(choice);
  assert.equal(replay.kind === 'saved' && replay.replay, true);
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, 1);
  const again = story.invoke({
    ...choice,
    invocation_id: 'dddddddd-0000-4000-8000-000000000002',
    input: { ancestry: 'road_born' },
  });
  assert.equal(again.kind === 'saved' && (again.decision as { kind: string }).kind, 'rejected');
  assert.equal(gameView(story.world()).ancestry, 'fen_born');
});

// Breaks: fey creation omits its initial faction row or receipt, so cold reopen cannot justify Priory/Fen −2.
test('fey choice saves and reopens its initial faction with creation receipt', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'd11-fey-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const a = chapter(join(dir, 'save.db'));
  t.after(() => a.sql.close());
  const story = a.open();
  const result = story.invoke({
    invocation_id: 'dddddddd-0000-4000-8000-000000000004',
    actor_id: a.fresh.character,
    action_key: 'choose_ancestry',
    target_ids: [],
    input: { ancestry: 'fey_touched' },
  });
  assert.equal(result.kind, 'saved');
  const receipt = JSON.parse(
    a.sql.prepare('SELECT response FROM receipt').get()!.response as string,
  );
  assert.ok(
    receipt.delta.ops.some(
      (op: { op: string; value?: number; fact?: { key: string } }) =>
        op.op === 'fact.assign' && op.fact?.key === 'priory_fen_axis' && op.value === -2,
    ),
  );
  const reopened = a.open();
  assert.equal(gameView(reopened.world()).ancestry, 'fey_touched');
  assert.deepEqual(
    a.sql
      .prepare("SELECT value FROM state_row WHERE section='facts'")
      .all()
      .map((row) => JSON.parse(row.value as string)),
    [-2],
  );
});

// Breaks: a real corpse commit drops the selected character row, so cold reopen revives the
// picker or loses the six values and inherited effects.
test('chosen character and effects survive corpse death and cold reopen', (t) => {
  const content = structuredClone(read('protocol/fixtures/missing_child_v038_hash.json').value);
  content.entry.key = 'hound_run';
  content.world.combat.player_attack.chance = 0;
  delete content.world.combat.dodge;
  for (const npc of Object.values(content.npcs) as { key: string; attack?: object }[])
    if (npc.key === 'fen_hound')
      Object.assign(npc.attack!, { chance: 100, damage_min: 10, damage_max: 10 });
  const canonical = encode(content),
    sha256 = createHash('sha256').update(canonical).digest('hex');
  const bundle = { canonical, sha256 };
  const dir = mkdtempSync(join(tmpdir(), 'd11-death-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  assert.equal(
    a.game.invoke({
      action_key: 'choose_ancestry' as never,
      target_ids: [],
      input: { ancestry: 'fen_born' as never },
    }).kind,
    'saved',
  );
  const target = a.game.view().view.entities[0]?.id;
  assert.ok(target);
  assert.equal(
    a.game.invoke({ action_key: 'attack' as never, target_ids: [target], input: {} }).kind,
    'saved',
  );
  a.clock.wall += 3000;
  a.clock.mono += 3000;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.equal(a.game.view().view.place.id, '2ef35eee-f837-8b28-bea7-9748a332940a');
  a.sql.close();

  const cold = elapsedHost(path, { wall: a.clock.wall, mono: a.clock.mono }, bundle);
  t.after(() => cold.sql.close());
  const view = cold.game.view().view;
  assert.equal(view.ancestry, 'fen_born');
  assert.equal(view.ancestry_choices, undefined);
  assert.deepEqual(
    view.attributes?.map((x) => [x.attribute.key, x.value]),
    [
      ['con', 10],
      ['dex', 10],
      ['int', 10],
      ['per', 6],
      ['spi', 10],
      ['str', 10],
    ],
  );
  assert.equal(view.skills?.find((s) => s.skill.key === 'swim')?.acquired, true);
  assert.deepEqual(
    cold.sql
      .prepare(
        "SELECT value FROM state_row WHERE section='facts' AND json_extract(key,'$.fact.key')='priory_fen_axis'",
      )
      .all()
      .map((row) => JSON.parse(row.value as string)),
    [-2],
  );
  assert.deepEqual(
    cold.sql
      .prepare("SELECT value FROM state_row WHERE section='characters'")
      .all()
      .map((row) => JSON.parse(row.value as string).ancestry),
    ['fen_born'],
  );
  assert.equal(
    cold.sql
      .prepare(
        "SELECT count(*) AS n FROM state_row WHERE section='created' AND json_extract(value,'$.origin.kind')='death'",
      )
      .get()!.n,
    1,
  );
  const loaded = loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: content, content_hash: sha256 })),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  if (!loaded.ok) return;
  const fresh = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const reopened = openStory(cold.db, [{ fresh, content_hash: sha256 }], cold.host);
  assert.equal(reopened.kind, 'open');
  if (reopened.kind !== 'open') return;
  const second = reopened.invoke({
    invocation_id: 'dddddddd-0000-4000-8000-000000000013',
    actor_id: fresh.character,
    action_key: 'choose_ancestry',
    target_ids: [],
    input: { ancestry: 'road_born' },
  });
  assert.equal(second.kind, 'saved');
  if (second.kind === 'saved')
    assert.deepEqual(second.decision, {
      kind: 'rejected',
      error: { code: 'unsupported_capability' },
    });
  assert.equal(gameView(reopened.world()).ancestry_choices, undefined);
});

// Breaks: a valid-looking row with a forged ancestry opens despite contradicting its accepted receipt.
test('forged ancestry row is save_corrupt without replacing the save', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'd11-corrupt-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const a = chapter(join(dir, 'save.db'));
  t.after(() => a.sql.close());
  const story = a.open();
  const result = story.invoke({
    invocation_id: 'dddddddd-0000-4000-8000-000000000003',
    actor_id: a.fresh.character,
    action_key: 'choose_ancestry',
    target_ids: [],
    input: { ancestry: 'fen_born' },
  });
  assert.equal(result.kind, 'saved');
  const row = a.sql.prepare("SELECT key,value FROM state_row WHERE section='characters'").get() as {
    key: string;
    value: string;
  };
  const value = JSON.parse(row.value);
  value.ancestry = 'road_born';
  a.sql
    .prepare("UPDATE state_row SET value=? WHERE section='characters' AND key=?")
    .run(JSON.stringify(value), row.key);
  assert.equal(
    openStory(a.db, [{ fresh: a.fresh, content_hash: a.bundle.sha256 }], a.host).kind,
    'save_corrupt',
  );
  assert.equal(
    (
      a.sql
        .prepare("SELECT value FROM state_row WHERE section='characters' AND key=?")
        .get(row.key) as { value: string }
    ).value,
    JSON.stringify(value),
  );
});

// Breaks: a failed or unknown creation COMMIT exposes a partial selection, or a lost reply writes the choice twice on retry.
test('creation reconciles failed and lost real SQLite commits atomically', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'd11-commit-'));
  t.after(() => rmSync(dir, { recursive: true }));
  for (const fault of ['failed', 'lost'] as const) {
    const a = chapter(join(dir, `${fault}.db`));
    t.after(() => a.sql.close());
    let story = a.open();
    const choice = {
      invocation_id: 'dddddddd-0000-4000-8000-000000000004',
      actor_id: a.fresh.character,
      action_key: 'choose_ancestry',
      target_ids: [],
      input: { ancestry: 'fen_born' },
    };
    a.sql.exec(
      'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
    );
    a.fault.kind = fault;
    a.fault.armed = true;
    assert.equal(story.invoke(choice).kind, 'pending');
    assert.equal(
      story.invoke({ ...choice, invocation_id: 'dddddddd-0000-4000-8000-000000000005' }).kind,
      'pending',
    );
    a.fault.reads = false;
    if (a.sql.isTransaction) a.sql.exec('ROLLBACK');
    story = a.open();
    assert.equal(gameView(story.world()).ancestry, fault === 'lost' ? 'fen_born' : undefined);
    const retry = story.invoke(choice);
    assert.equal(retry.kind, 'saved');
    if (retry.kind === 'saved') assert.equal(retry.replay, fault === 'lost');
    assert.equal(gameView(story.world()).ancestry, 'fen_born');
    assert.equal(
      a.sql.prepare("SELECT count(*) AS n FROM state_row WHERE section='characters'").get()!.n,
      1,
    );
  }
});
