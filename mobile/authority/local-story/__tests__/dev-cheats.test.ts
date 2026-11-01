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
  assert.equal(game.facts()['toolbox_showcase@0.0.1:fact/cellar_disarmed'], undefined);
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
  assert.equal(Object.values(again.facts()).includes(true), true);
});
