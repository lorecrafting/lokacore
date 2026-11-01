// A release refuses the cheats; a dev host's are receipts a reopen re-decides (cartridge.md#author-preview).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { read } from '../../../../kernel/ts/test/read.ts';
import { openGame } from '../session.ts';
import type { Intent, Reply } from '../../../packages/game-view/session.ts';
import { sqliteHost } from './elapsed-host.test.ts';

const { canonical, sha256 } = read('protocol/fixtures/toolbox_showcase_hash.json');
const bundle = { canonical, sha256 };
const ref = (kind: string, key: string) => ({
  cartridge_id: 'toolbox_showcase',
  cartridge_version: '0.0.1',
  kind,
  key,
});
const cheat = (action_key: string, input: object, token: string) =>
  ({ action_key, target_ids: [], input, view_freshness_token: token }) as unknown as Intent;
// A fact row's key is its canonical target JSON; the instance scope carries a per-game context id.
const disarmed = (facts: Record<string, unknown>) =>
  Object.keys(facts)
    .filter((k) => k.includes('"key":"cellar_disarmed"'))
    .map((k) => facts[k]);
const answer = (r: Reply) =>
  r.kind === 'saved' && r.decision.kind === 'rejected'
    ? r.decision.error.code
    : r.kind === 'saved'
      ? r.decision.kind
      : r.kind;

// Break: the host gate is dropped, so a release decides a cheat; this is the release's refusal.
test('a host without dev refuses both cheats and the world stays', () => {
  const a = sqliteHost();
  const game = openGame(a.db, bundle, a.host);
  const { token, view } = game.view();
  const room = view.place.id;
  assert.equal(
    answer(game.invoke(cheat('dev_go_to_room', { room: ref('room', 'boar_run') }, token))),
    'unsupported_capability',
  );
  assert.equal(
    answer(
      game.invoke(
        cheat(
          'dev_set_fact',
          { fact: ref('fact', 'cellar_disarmed'), value: true },
          game.view().token,
        ),
      ),
    ),
    'unsupported_capability',
  );
  assert.equal(game.view().view.place.id, room);
  assert.deepEqual(disarmed(game.facts()), []);
});

// Break: reopen re-decides a dev receipt through `step`, which refuses it: the save would not open.
test('a dev host decides both cheats and a reopen holds them', () => {
  const a = sqliteHost();
  const game = openGame(a.db, bundle, { ...a.host, dev: true });
  const before = game.view().view.place.title.key;
  assert.equal(before, 'room.crossroads_inn.title');
  assert.equal(
    answer(
      game.invoke(cheat('dev_go_to_room', { room: ref('room', 'boar_run') }, game.view().token)),
    ),
    'accepted',
  );
  assert.equal(
    answer(
      game.invoke(
        cheat(
          'dev_set_fact',
          { fact: ref('fact', 'cellar_disarmed'), value: true },
          game.view().token,
        ),
      ),
    ),
    'accepted',
  );
  const again = openGame(a.db, bundle, { ...a.host, dev: true });
  assert.equal(again.view().view.place.title.key, 'room.boar_run.title');
  assert.deepEqual(disarmed(again.facts()), [true]);
});

const another = (t: { type: string; default: unknown; values?: unknown[] }) =>
  t.type === 'bool'
    ? !t.default
    : t.type === 'enum'
      ? t.values!.find((v) => v !== t.default)
      : t.default === 0
        ? 1
        : 0;

// Break: a cheat writes a fact a load proof demands a mechanic receipt for: the save never reopens.
for (const [name, refused] of [
  ['toolbox_showcase', []],
  ['codex_sampler', []],
  ['expedition_sampler', ['night_survived']],
] as const)
  test(`any fact a cheat sets on ${name} reopens; the proven ones are refused`, () => {
    const sampler = read(`protocol/fixtures/${name}_hash.json`);
    const facts: Record<string, any> = JSON.parse(sampler.canonical).facts;
    const answers = Object.values(facts).map((f) => {
      const a = sqliteHost();
      const game = openGame(a.db, sampler, { ...a.host, dev: true });
      const answered = answer(
        game.invoke(
          cheat(
            'dev_set_fact',
            {
              fact: { cartridge_id: name, cartridge_version: '0.0.1', kind: 'fact', key: f.key },
              value: another(f.value_type),
            },
            game.view().token,
          ),
        ),
      );
      if (answered === 'accepted') openGame(a.db, sampler, { ...a.host, dev: true });
      return [f.key, answered] as const;
    });
    for (const key of refused)
      assert.deepEqual(
        answers.find(([k]) => k === key),
        [key, 'invalid_state'],
      );
  });

// Break: a release replays a dev save instead of refusing it (a copied preview file). Both samplers:
// a cheat on one history-checked cartridge, and on one whose reopen skips the history replay.
for (const [name, room] of [
  ['toolbox_showcase', 'boar_run'],
  ['codex_sampler', ''],
] as const)
  test(`a release does not open a save holding a cheat (${name})`, () => {
    const sampler = read(`protocol/fixtures/${name}_hash.json`);
    const rooms = Object.values(JSON.parse(sampler.canonical).rooms as Record<string, any>);
    const a = sqliteHost();
    const game = openGame(a.db, sampler, { ...a.host, dev: true });
    const here = game.view().view.place.title.key;
    const key = room || rooms.find((r) => `room.${r.key}.title` !== here).key;
    const to = { cartridge_id: name, cartridge_version: '0.0.1', kind: 'room', key };
    assert.equal(
      answer(game.invoke(cheat('dev_go_to_room', { room: to }, game.view().token))),
      'accepted',
    );
    assert.throws(
      () => openGame(a.db, sampler, a.host),
      (e: any) => e.cause.kind === 'save_corrupt',
    );
    openGame(a.db, sampler, { ...a.host, dev: true }); // the refusal is the host's, not the save's
  });

// Break: the refusal reads the command another way than replay, so an edited save still opens.
for (const [form, edit] of [
  [
    'a duplicate type',
    (c: string) => c.replace('"type":"dev_go_to_room"', '"type":"look","type":"dev_go_to_room"'),
  ],
  [
    'a duplicate payload',
    (c: string) => c.replace('"payload":', '"payload":{"type":"look"},"payload":'),
  ],
  ['an escaped type', (c: string) => c.replace('"type":"dev_', '"type":"\\u0064ev_')],
] as const)
  test(`a release does not open a cheat hidden by ${form}`, () => {
    const a = sqliteHost();
    const game = openGame(a.db, bundle, { ...a.host, dev: true });
    const to = { room: ref('room', 'boar_run') };
    assert.equal(answer(game.invoke(cheat('dev_go_to_room', to, game.view().token))), 'accepted');
    const { command } = a.db.getFirstSync<{ command: string }>(
      `SELECT command FROM receipt WHERE command LIKE '%dev_go_to_room%'`,
    )!;
    const forged = edit(command);
    assert.notEqual(forged, command);
    a.db.runSync('UPDATE receipt SET command=? WHERE command=?', forged, command);
    assert.throws(
      () => openGame(a.db, bundle, a.host),
      (e: any) => e.cause.kind === 'save_corrupt',
    );
  });

// Break: `adopt` loads without the host's dev flag, so the settled cheat reads as a corrupt save.
test('a dev cheat retried after a lost COMMIT acknowledgement replays', () => {
  const a = sqliteHost();
  const game = openGame(a.db, bundle, { ...a.host, dev: true });
  const intent = cheat('dev_go_to_room', { room: ref('room', 'boar_run') }, game.view().token);
  Object.assign(a.fault, { kind: 'lost', armed: true });
  assert.equal(game.invoke(intent).kind, 'pending');
  a.fault.reads = false;
  assert.equal(answer(game.invoke(intent)), 'accepted');
  assert.equal(game.view().view.place.title.key, 'room.boar_run.title');
});

// Break: every receive target is refused again, though no reopen proves one by state.
test('a receive target is set and reopens', () => {
  const lantern = read('protocol/fixtures/cartridge_lantern_hash.json');
  const b = { canonical: lantern.canonical, sha256: lantern.sha256 };
  const a = sqliteHost();
  const game = openGame(a.db, b, { ...a.host, dev: true });
  const fact = { ...ref('fact', 'search_plan'), cartridge_id: 'lantern_proof' };
  const set = cheat('dev_set_fact', { fact, value: 'party_led' }, game.view().token);
  assert.equal(answer(game.invoke(set)), 'accepted');
  const again = openGame(a.db, b, { ...a.host, dev: true });
  assert.match(JSON.stringify(again.facts()), /party_led/);
});

// Break: the accepted filter goes, and a cheat that changed nothing shuts a release out.
test('a save holding only a refused cheat opens on a release', () => {
  const a = sqliteHost();
  const game = openGame(a.db, bundle, { ...a.host, dev: true });
  const missing = cheat('dev_go_to_room', { room: ref('room', 'nowhere') }, game.view().token);
  assert.equal(answer(game.invoke(missing)), 'not_found');
  assert.ok(openGame(a.db, bundle, a.host).view().token);
});
