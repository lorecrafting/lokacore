import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { group, intentOf } from '../../app/book/model.ts';
import { presenter } from '../../app/book/presenter.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

// Breaks: World hides an authored Read alias, or target-bearing entity actions leak into World.
test('Book preserves an aliased Read place offer and exact target through a live redraw', (t) => {
  const c = structuredClone(read('protocol/fixtures/missing_child_v003_hash.json').value);
  c.actions['ashmere_missing_child@0.0.3:action/peruse'] = {
    key: 'peruse',
    command: 'read',
    label: 'actions.read_notice',
    accessibility: 'actions.read_notice',
    target: { kind: 'entity', scopes: ['inspectable_details'] },
    input: [],
    priority: 0,
    policy: { policy_version: 1, root: { op: 'all', items: [] } },
  };
  c.rooms['ashmere_missing_child@0.0.3:room/ferry_landing'].actions = [
    { op: 'subtract', actions: ['read'] },
  ];
  c.items['ashmere_missing_child@0.0.3:item/brass_key'].location.room.key = 'ferry_landing';
  const canonical = encode(c);
  const a = elapsedHost(
    ':memory:',
    { wall: 10000, mono: 0 },
    {
      canonical,
      sha256: createHash('sha256').update(canonical).digest('hex'),
    },
  );
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
    [
      {
        label: 'Read the notice',
        action_key: 'peruse',
        target_ids: ['e368b8b9-c4a5-8d0e-82a0-da17e2d59fe2'],
        input: {},
      },
    ],
  );
  assert.ok(
    controls.on('19785203-d373-8973-8e64-1a9d8e50be82').some((b) => b.action_key === 'take'),
  );
  const control = controls.place[0],
    token = control.token;
  a.clock.wall += 1000;
  a.clock.mono += 1000;
  assert.equal(a.game.pulse().kind, 'ready');
  book.press(control);
  assert.equal(book.screen().view.time, 64850);
  assert.deepEqual(book.screen().log, ['Keep the landing clear. Tie boats to the mooring post.']);
  assert.deepEqual(intentOf(control), {
    action_key: 'peruse',
    target_ids: ['e368b8b9-c4a5-8d0e-82a0-da17e2d59fe2'],
    input: {},
    view_freshness_token: token,
  });
});
