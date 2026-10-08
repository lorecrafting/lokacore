import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elapsedCommandId } from '../../../kernel/ts/src/foundation/id_source.ts';
import { forge, fresh, only, otherId } from './__tests__/chandlers-setup.test.ts';

// Breaks: reopen accepts an expiry receipt that fails another quest instance.
test('reopen refuses an expiry receipt that transitions another instance', () => {
  const kind = forge(true, (r) => {
    only(r, 'quest.transition').instance_id = otherId;
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry receipt whose quest transition is not to failed.
test('reopen refuses an expiry receipt that transitions to resolved', () => {
  const kind = forge(true, (r) => {
    only(r, 'quest.transition').to = 'resolved';
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry receipt whose quest transition is outside the expiry's writer group.
test('reopen refuses an expiry receipt with the transition in another writer group', () => {
  const kind = forge(true, (r) => {
    only(r, 'quest.transition').writer_group = 2;
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry receipt whose outcome assignment is outside the expiry's writer group.
test('reopen refuses an expiry receipt with the outcome in another writer group', () => {
  const kind = forge(true, (r) => {
    only(r, 'fact.assign', 'priory_tithe_delivered').writer_group = 2;
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry receipt that assigns the outcome at another player's scope.
test('reopen refuses an expiry receipt with the outcome at another scope', () => {
  const kind = forge(true, (r) => {
    only(r, 'fact.assign', 'priory_tithe_delivered').scope = {
      kind: 'player',
      character_id: 'aaaaaaaa-1111-4222-8333-444444444444',
    };
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry receipt whose outcome assignment expected a value other than pending.
test('reopen refuses an expiry receipt whose outcome expected another value', () => {
  const kind = forge(true, (r) => {
    only(r, 'fact.assign', 'priory_tithe_delivered').expected = 'late';
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry receipt whose trust assignment expected a nonzero trust.
test('reopen refuses an expiry receipt whose trust expected another value', () => {
  const kind = forge(true, (r) => {
    only(r, 'fact.assign', 'peg_trust').expected = 1;
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry receipt that assigns the trust penalty twice.
test('reopen refuses an expiry receipt with two trust assignments', () => {
  const kind = forge(true, (r) => r.delta.ops.push({ ...only(r, 'fact.assign', 'peg_trust') }));
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry outcome event caused by something other than the due job.
test('reopen refuses an expiry outcome event with another cause', () => {
  const kind = forge(true, (r) => {
    r.events.find(
      (e) =>
        e.payload.type === 'fact_changed' &&
        (e.payload.fact as { key: string }).key === 'priory_tithe_delivered',
    )!.causation_id = otherId;
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry outcome event at another player's scope.
test('reopen refuses an expiry outcome event at another scope', () => {
  const kind = forge(true, (r) => {
    r.events.find(
      (e) =>
        e.payload.type === 'fact_changed' &&
        (e.payload.fact as { key: string }).key === 'priory_tithe_delivered',
    )!.scope = { kind: 'player', character_id: 'aaaaaaaa-1111-4222-8333-444444444444' };
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry whose elapsed interval starts at or after the deadline.
test('reopen refuses an expiry from an interval starting at the deadline', () => {
  const kind = forge(
    true,
    () => {},
    (c) => {
      Object.assign(c.payload, { from: 237601, until: 237602 });
      c.id = elapsedCommandId(c.payload.run_id as string, fresh.context, 237601, 237602);
    },
  );
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry whose elapsed interval ends before the deadline.
test('reopen refuses an expiry from an interval ending before the deadline', () => {
  const kind = forge(
    true,
    () => {},
    (c) => {
      c.payload.until = 237600;
      c.id = elapsedCommandId(
        c.payload.run_id as string,
        fresh.context,
        c.payload.from as number,
        237600,
      );
    },
  );
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry whose job completion, transition and assignments sit in writer group 0.
test('reopen refuses an expiry receipt with its writes in writer group 0', () => {
  const kind = forge(true, (r) => {
    for (const o of r.delta.ops)
      if (
        o.op === 'job.complete' ||
        o.op === 'quest.transition' ||
        (o.op === 'fact.assign' &&
          ['priory_tithe_delivered', 'peg_trust'].includes((o.fact as { key: string }).key))
      )
        o.writer_group = 0;
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an accept receipt with a second choice resolution under another cause.
test('reopen refuses an accept receipt with two choice resolutions', () => {
  const kind = forge(false, (r) => {
    const resolved = r.events.find((e) => e.payload.type === 'choice_resolved')!;
    r.events.push({ ...resolved, causation_id: otherId });
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an accept receipt that binds its due job to another quest instance.
test('reopen refuses an accept receipt scheduling the due job for another instance', () => {
  const kind = forge(false, (r) => {
    only(r, 'job.schedule').quest_instance_id = otherId;
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an accept receipt that schedules the due job for another actor.
test('reopen refuses an accept receipt scheduling the due job for another actor', () => {
  const kind = forge(false, (r) => {
    only(r, 'job.schedule').actor_id = otherId;
  });
  assert.equal(kind, 'save_corrupt');
});
