// Ancestry choice through real SQLite on the derived sampler (toolbox row 2), with strong
// inheriting skill swim and standing -2 inline so every creation effect is saved.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadCartridge,
  newWorld,
  gameView,
  INSTALLED,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-choice-'));
let compiled: any;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/derived_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  compiled = JSON.parse(readFileSync(file, 'utf8')).cartridge;
} finally {
  rmSync(scratch, { recursive: true });
}
const ref = (kind: string, key: string) => ({
  cartridge_id: 'derived_sampler',
  cartridge_version: '0.0.1',
  kind,
  key,
});
const named = (kind: string, key: string) => `derived_sampler@0.0.1:${kind}/${key}`;
compiled.manifest.requires.capabilities.skills = compiled.lock.capabilities.skills = 1;
compiled.skills = {
  [named('skill', 'swim')]: {
    key: 'swim',
    label: 'ancestry.strong.label',
    requirement: 'ancestry.strong.label',
    qualification: {
      policy_version: 1,
      root: { op: 'stat_compare', attribute: ref('attribute', 'str'), at_least: 100 },
    },
  },
};
compiled.facts[named('fact', 'skill_swim')] = {
  key: 'skill_swim',
  version: 1,
  value_type: { type: 'bool', default: false },
  scopes: ['player'],
  meaning: "Skill swim's acquisition (skills@1): only skills@1 writes it.",
};
compiled.facts[named('fact', 'standing')] = {
  key: 'standing',
  version: 1,
  value_type: { type: 'int', default: 0 },
  scopes: ['player'],
  meaning: 'Controlled faction standing.',
};
compiled.ancestries.strong.skill = ref('skill', 'swim');
compiled.ancestries.strong.faction = { fact: ref('fact', 'standing'), value: -2 };

function release(content: object) {
  const canonical = encode(content as never);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const fresh = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  return { bundle: { canonical, sha256 }, fresh };
}

function chapter(path: string) {
  const { bundle, fresh } = release(compiled);
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

// Breaks: creation commits an ancestry without all its values, inherited skill or faction row, or
// matching receipt; cold reopen loses the once-only choice.
test('strong choice commits one creation receipt and reopens inherited state', (t) => {
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
    input: { ancestry: 'strong' },
  };
  assert.deepEqual(
    gameView(story.world()).ancestry_choices?.map((c) => c.key),
    ['hardy', 'nimble', 'strong'],
  );
  const result = story.invoke(choice);
  assert.equal(result.kind, 'saved');
  if (result.kind === 'saved') assert.equal((result.decision as { kind: string }).kind, 'accepted');
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, 1);
  const receipt = JSON.parse(
    a.sql.prepare('SELECT response FROM receipt').get()!.response as string,
  );
  assert.ok(
    receipt.delta.ops.some(
      (op: { op: string; value?: number; fact?: { key: string } }) =>
        op.op === 'fact.assign' && op.fact?.key === 'standing' && op.value === -2,
    ),
  );
  story = a.open();
  assert.equal(gameView(story.world()).ancestry, 'strong');
  assert.deepEqual(
    Object.values(story.world().state.characters![a.fresh.character].attributes).sort(
      (x, y) => x - y,
    ),
    [10, 10, 15],
  );
  assert.equal(gameView(story.world()).skills?.find((s) => s.skill.key === 'swim')?.acquired, true);
  assert.deepEqual(
    a.sql
      .prepare(
        "SELECT value FROM state_row WHERE section='facts' AND json_extract(key,'$.fact.key')='standing'",
      )
      .all()
      .map((row) => JSON.parse(row.value as string)),
    [-2],
  );
  const replay = story.invoke(choice);
  assert.equal(replay.kind === 'saved' && replay.replay, true);
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, 1);
  const again = story.invoke({
    ...choice,
    invocation_id: 'dddddddd-0000-4000-8000-000000000002',
    input: { ancestry: 'nimble' },
  });
  assert.equal(again.kind === 'saved' && (again.decision as { kind: string }).kind, 'rejected');
  assert.equal(gameView(story.world()).ancestry, 'strong');
});

// Breaks: a real corpse commit drops the selected character row, so cold reopen revives the
// picker or loses the six values and inherited effects.
test('chosen character and effects survive corpse death and cold reopen', (t) => {
  // Start in the yard beside a dummy that always kills; death returns the body to the hall shrine.
  const content = structuredClone(compiled);
  content.entry.key = 'yard';
  content.world.combat.player_attack.chance = 0;
  Object.assign(content.npcs[named('npc', 'dummy')].attack, {
    chance: 100,
    damage_min: 100,
    damage_max: 100,
  });
  const { bundle, fresh } = release(content);
  const sha256 = bundle.sha256;
  const dir = mkdtempSync(join(tmpdir(), 'd11-death-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  assert.equal(
    a.game.invoke({
      action_key: 'choose_ancestry' as never,
      target_ids: [],
      input: { ancestry: 'strong' as never },
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
  assert.equal(a.game.view().view.place.id, fresh.roomIds[named('room', 'hall')]);
  a.sql.close();

  const cold = elapsedHost(path, { wall: a.clock.wall, mono: a.clock.mono }, bundle);
  t.after(() => cold.sql.close());
  const view = cold.game.view().view;
  assert.equal(view.ancestry, 'strong');
  assert.equal(view.ancestry_choices, undefined);
  assert.deepEqual(
    view.attributes?.map((x) => [x.attribute.key, x.value]),
    [
      ['con', 10],
      ['dex', 10],
      ['str', 15],
    ],
  );
  assert.equal(view.skills?.find((s) => s.skill.key === 'swim')?.acquired, true);
  assert.deepEqual(
    cold.sql
      .prepare(
        "SELECT value FROM state_row WHERE section='facts' AND json_extract(key,'$.fact.key')='standing'",
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
    ['strong'],
  );
  assert.equal(
    cold.sql
      .prepare(
        "SELECT count(*) AS n FROM state_row WHERE section='created' AND json_extract(value,'$.origin.kind')='death'",
      )
      .get()!.n,
    1,
  );
  const reopened = openStory(cold.db, [{ fresh, content_hash: sha256 }], cold.host);
  assert.equal(reopened.kind, 'open');
  if (reopened.kind !== 'open') return;
  const second = reopened.invoke({
    invocation_id: 'dddddddd-0000-4000-8000-000000000013',
    actor_id: fresh.character,
    action_key: 'choose_ancestry',
    target_ids: [],
    input: { ancestry: 'nimble' },
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
    input: { ancestry: 'strong' },
  });
  assert.equal(result.kind, 'saved');
  const row = a.sql.prepare("SELECT key,value FROM state_row WHERE section='characters'").get() as {
    key: string;
    value: string;
  };
  const value = JSON.parse(row.value);
  value.ancestry = 'nimble';
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
      input: { ancestry: 'strong' },
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
    assert.equal(gameView(story.world()).ancestry, fault === 'lost' ? 'strong' : undefined);
    const retry = story.invoke(choice);
    assert.equal(retry.kind, 'saved');
    if (retry.kind === 'saved') assert.equal(retry.replay, fault === 'lost');
    assert.equal(gameView(story.world()).ancestry, 'strong');
    assert.equal(
      a.sql.prepare("SELECT count(*) AS n FROM state_row WHERE section='characters'").get()!.n,
      1,
    );
  }
});
