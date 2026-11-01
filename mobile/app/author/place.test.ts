// Keep my place: a recorded path survives an edit that shifts entity ids, and a step the edited
// cartridge refuses stops the replay by name (docs/system/cartridge.md#author-preview).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Intent, Reply } from '../../packages/game-view/session.ts';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { asRefs, caughtUp, replay, type Replayable, type Step } from './place.ts';

const NPC = 'sampler@0.0.1:npc/maud';
const intent = (target_ids: string[], input = {}) =>
  ({ action_key: 'talk', target_ids, input }) as unknown as Intent;
const accepted = { kind: 'saved', decision: { kind: 'accepted' } } as Reply;
const refused = {
  kind: 'saved',
  decision: { kind: 'rejected', error: { code: 'not_here' } },
} as unknown as Reply;

/** A session over controlled ids whose answers come from `replies`, in order. */
function session(ids: Record<string, string>, replies: Reply[], choice?: string) {
  const sent: Intent[] = [];
  const game: Replayable = {
    view: () => ({
      view: choice ? { choice: { continuation_id: choice as never } } : {},
      token: 't9',
    }),
    invoke: (i) => (sent.push(i), replies[sent.length - 1]!),
    entityIds: () => ids,
  };
  return { game, sent };
}

test('a target follows its ref into a cartridge where the entity has a new id', () => {
  // Break: replaying the recorded id (a stale uuid) instead of resolving the ref.
  const step: Step = { intent: asRefs(intent(['a1']), { [NPC]: 'a1' }) };
  assert.deepEqual(step.intent.target_ids, [NPC]);
  const { game, sent } = session({ [NPC]: 'b1' }, [accepted]);
  assert.deepEqual(
    replay([step], game, () => {}),
    { done: 1 },
  );
  assert.equal(sent[0]!.target_ids[0], 'b1');
  assert.equal(sent[0]!.view_freshness_token, 't9');
});

test('a refused step stops the replay, named by ordinal, and later steps are not sent', () => {
  // Break: carrying on past a refusal, or counting the refused step as done.
  const steps: Step[] = [
    { intent: intent([NPC]) },
    { advance: 60_000 },
    { intent: intent([NPC]) },
    { intent: intent([NPC]) },
  ];
  const advanced: number[] = [];
  const { game, sent } = session({ [NPC]: 'b1' }, [accepted, refused]);
  const out = replay(steps, game, (ms) => advanced.push(ms));
  assert.equal(out.done, 2);
  assert.match(out.failed!, /^step 3 \(talk .*not_here/);
  assert.equal(sent.length, 2);
  assert.deepEqual(advanced, [60_000]);
});

test('a target the edited cartridge no longer defines stops the replay before any send', () => {
  // Break: sending the ref string as an entity id and letting the kernel fault on it.
  const { game, sent } = session({}, [accepted]);
  const out = replay([{ intent: intent([NPC]) }], game, () => {});
  assert.equal(out.done, 0);
  assert.match(out.failed!, /step 1 .*no sampler@0.0.1:npc\/maud/);
  assert.equal(sent.length, 0);
});

test('a choice replays against the continuation this run issued', () => {
  // Break: sending the recorded continuation id, which the fresh run never opened.
  const { game, sent } = session({}, [accepted], 'c2');
  replay([{ intent: intent([], { choice_id: 'go', continuation_id: 'c1' }) }], game, () => {});
  assert.deepEqual(sent[0]!.input, { choice_id: 'go', continuation_id: 'c2' });
});

test('a step gains a continuation only when it had one and a choice is open', () => {
  // Break: `&&` to `||`: a plain step sent during a choice gains a continuation, and a recorded
  // continuation with no choice open reads view.choice of undefined and throws.
  const open = session({}, [accepted], 'c2');
  replay([{ intent: intent([], { choice_id: 'go' }) }], open.game, () => {});
  assert.deepEqual(open.sent[0]!.input, { choice_id: 'go' });
  const closed = session({}, [refused]);
  const out = replay([{ intent: intent([], { continuation_id: 'c1' }) }], closed.game, () => {});
  assert.match(out.failed!, /not_here/);
  assert.deepEqual(closed.sent[0]!.input, { continuation_id: 'c1' });
});

// Breaks: a replayed advance only drains (a drain never captures the moved clocks), so the world
// clock stays put and the next replayed input is refused as catching up, or the loop stops early.
test('an advance step credits the moved dev clock before the next input', () => {
  const a = elapsedHost();
  try {
    assert.equal(
      a.game.invoke({ action_key: 'look' as never, target_ids: [], input: {} }).kind,
      'saved',
    );
    const before = a.game.view().view.time;
    a.clock.wall += 3_600_000;
    a.clock.mono += 3_600_000;
    caughtUp(a.game);
    assert.equal(a.game.view().view.time, before + 180_000); // one real hour at the bundle's rate 50
    assert.equal(a.game.pending(), false);
  } finally {
    a.sql.close();
  }
});

test('a long advance delivers all its time and stops draining when caught up', () => {
  // Break: the drain loop dropped or stopped early: one active pulse delivers 648000 ms of these
  // 43200000 (ten real days at rate 50) and pending() is false either way, so a replay reads green.
  const a = elapsedHost();
  try {
    assert.equal(
      a.game.invoke({ action_key: 'look' as never, target_ids: [], input: {} }).kind,
      'saved',
    );
    const before = a.game.view().view.time;
    a.clock.wall += 864_000_000;
    a.clock.mono += 864_000_000;
    caughtUp(a.game);
    assert.equal(a.game.view().view.time, before + 43_200_000);
    assert.equal(a.game.pending(), false);
  } finally {
    a.sql.close();
  }
});

test('the drain loop gives up at 1000 rounds and stops on the first other reply', () => {
  // Break: a session stuck catching up hangs the page (no bound, or a different one); the loop
  // keeps pulsing after it has caught up.
  const pulsing = (kinds: (round: number) => string) => {
    const modes: string[] = [];
    caughtUp({ pulse: (mode) => ({ kind: kinds(modes.push(mode)) }) });
    return modes;
  };
  assert.equal(pulsing(() => 'catching_up').length, 1001);
  assert.deepEqual(
    pulsing((n) => (n < 3 ? 'catching_up' : 'idle')),
    ['active', 'drain', 'drain'],
  );
});
