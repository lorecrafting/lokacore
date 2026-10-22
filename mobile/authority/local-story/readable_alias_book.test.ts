import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codex, notices, PLAQUE } from '../../../kernel/ts/test/codex_fixture.ts';
import { group, intentOf } from '../../app/book/model.ts';
import { presenter } from '../../app/book/presenter.ts';
import { bundle, ids } from './__tests__/priory-fixture.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

const P = codex.prefix;

// Breaks: World hides an authored Read alias, or target-bearing entity actions leak into World.
test('Book preserves an aliased Read place offer and exact target through a live redraw', (t) => {
  const source = bundle((c) => {
    notices(c);
    c.actions[`${P}:action/peruse`] = {
      key: 'peruse',
      command: 'read',
      label: 'actions.read_plaque',
      accessibility: 'actions.read_plaque',
      target: { kind: 'entity', scopes: ['inspectable_details'] },
      input: [],
      priority: 0,
      policy: { policy_version: 1, root: { op: 'all', items: [] } },
    };
    c.rooms[`${P}:room/hall`].actions = [{ op: 'subtract', actions: ['read'] }];
    c.items[`${P}:item/carters_note`].location.room.key = 'hall';
  });
  const id = ids(source.value),
    plaque = id['detail/hall/plaque'];
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, source);
  t.after(() => a.sql.close());
  const book = presenter(a.game);
  a.game.subscribe(book.update);
  const controls = group(book.screen().buttons);
  assert.deepEqual(
    controls.place.map(({ label, action_key, target_ids, input }) => ({
      label,
      action_key,
      target_ids,
      input,
    })),
    [{ label: 'Read the plaque', action_key: 'peruse', target_ids: [plaque], input: {} }],
  );
  assert.ok(controls.on(id['item/carters_note']).some((b) => b.action_key === 'take'));
  const control = controls.place[0],
    token = control.token;
  a.clock.wall += 1000;
  a.clock.mono += 1000;
  assert.equal(a.game.pulse().kind, 'ready');
  book.press(control);
  assert.deepEqual(book.screen().log, []);
  assert.deepEqual(book.screen().detail(plaque), [PLAQUE]);
  assert.deepEqual(intentOf(control), {
    action_key: 'peruse',
    target_ids: [plaque],
    input: {},
    view_freshness_token: token,
  });
});
