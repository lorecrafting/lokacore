// Keep my place: a recorded path survives an edit that shifts entity ids, and a step the edited
// cartridge refuses stops the replay by name (docs/system/cartridge.md#author-preview).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Intent, Reply } from '../../packages/game-view/session.ts';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import {
  advanced,
  asRefs,
  cheatIntent,
  cheatNote,
  sendCheat,
  caughtUp,
  dropStep,
  frozenClock,
  recording,
  replay,
  type Replayable,
  type Step,
} from './place.ts';

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
    pulse: () => ({ kind: 'ready' }),
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

// Break: the panel's "drop this step" removes the wrong step because replay's `done` counts advances.
test('dropping the refused step removes that step, counting the advances before it', () => {
  const steps: Step[] = [
    { intent: intent([]) },
    { advance: 1000 },
    { intent: intent([NPC]) },
    { intent: intent([]) },
  ];
  const { done } = replay(steps, session({ [NPC]: 'id' }, [accepted, refused]).game, () => {});
  assert.equal(done, 2);
  assert.deepEqual(dropStep(steps, done), [steps[0], steps[1], steps[3]]);
});

// Break: a hand-edited advance reaches the clock, moving it backward or turning it into a string,
// in the preview as in the check; or a zero advance, which is whole, is refused.
test('an advance that is not whole non-negative milliseconds stops before the clock, droppable', () => {
  const clock: number[] = [];
  const replayAdvance = (advance: unknown) =>
    replay([{ advance } as Step], session({}, []).game, (ms) => clock.push(ms));
  const stopped = (shown: unknown) => ({
    done: 0,
    failed: `step 1 (advance ${shown}): not whole milliseconds`,
    refused: true,
  });
  assert.deepEqual(replayAdvance(-1), stopped(-1));
  assert.deepEqual(replayAdvance('5'), stopped('5'));
  assert.deepEqual(replayAdvance(1.5), stopped(1.5));
  assert.deepEqual(clock, []);
  assert.deepEqual(replayAdvance(0), { done: 1 });
  assert.deepEqual(clock, [0]);
});

// Break: a timed rule that faults, or a drain that never ends, passes the gate as ok.
test('an advance whose delivery does not end ready stops the replay at that step', () => {
  const game = session({}, []).game;
  const after = (kinds: { kind: string; code?: string; message?: string }[]) => {
    const pulses = [{ kind: 'ready' }, ...kinds];
    return replay(
      [{ advance: 5 }],
      { ...game, pulse: () => pulses.shift() ?? kinds.at(-1)! },
      () => {},
    );
  };
  assert.deepEqual(after([{ kind: 'ready' }]), { done: 1 });
  assert.deepEqual(after([{ kind: 'fault', code: 'x' }]), {
    done: 0,
    failed: 'step 1 (advance 5): fault x',
  });
  assert.deepEqual(after([{ kind: 'error', message: 'corrupt' }]), {
    done: 0,
    failed: 'step 1 (advance 5): error corrupt',
  });
  assert.deepEqual(after([{ kind: 'catching_up' }]), {
    done: 0,
    failed: 'step 1 (advance 5): catching_up',
  });
});

// Break: the panel offers to drop a valid step that only caught a pending reply or a fault.
test('only a step the game refused is marked refused', () => {
  const once = (reply: unknown, ids: Record<string, string> = { [NPC]: 'b1' }) =>
    replay([{ intent: intent([NPC]) }], session(ids, [reply as Reply]).game, () => {}).refused;
  assert.equal(once(refused), true);
  assert.equal(once(refused, {}), true); // the edit removed the target
  assert.equal(once({ kind: 'catching_up' }), undefined);
  assert.equal(once({ kind: 'saved', decision: { kind: 'fault', code: 'x' } }), undefined);
});

test('the frozen clock moves wall and monotonic together, and only when told', () => {
  // Break: a wall that stands still loses a dev-clock move for any reader of the wall clock.
  let moved = 0;
  const clock = frozenClock(() => moved);
  const [wall, mono] = [clock.wall(), clock.monotonic()];
  moved = 600;
  assert.deepEqual([clock.wall() - wall, clock.monotonic() - mono], [600, 600]);
});

test('a step with both kinds, or an unreadable intent, stops by number', () => {
  // Break: an intent skipped beside an advance passes the gate; a missing input throws with no step number.
  for (const bad of [
    { advance: 0, intent: intent([]) },
    { intent: {} },
    1,
    { intent: { input: {}, target_ids: [1] } },
  ]) {
    const out = replay([bad as unknown as Step], {} as Replayable, () => {});
    assert.match(out.failed!, /^step 1: not a step/);
  }
});

// Break: the panel's keys reach the session as anything but the refs the schema takes, or a cheat
// reads as another (wrong action key, wrong kind).
test('a cheat is the ordinary invocation, by definition ref', () => {
  const m = { id: 'sampler', version: '0.0.1' };
  const ref = (kind: string, key: string) => ({
    cartridge_id: 'sampler',
    cartridge_version: '0.0.1',
    kind,
    key,
  });
  assert.deepEqual(cheatIntent({ op: 'go_to_room', room: 'well' }, m, 't'), {
    action_key: 'dev_go_to_room',
    target_ids: [],
    input: { room: ref('room', 'well') },
    view_freshness_token: 't',
  });
  assert.deepEqual(cheatIntent({ op: 'set_fact', fact: 'f', value: 2 }, m, 't'), {
    action_key: 'dev_set_fact',
    target_ids: [],
    input: { fact: ref('fact', 'f'), value: 2 },
    view_freshness_token: 't',
  });
});

// Break: an accepted cheat shows a refusal, or a refusal comes back blank or as a bare code.
test('a refused cheat says why in plain words', () => {
  assert.equal(cheatNote('go_to_room', accepted), '');
  assert.equal(
    cheatNote('set_fact', {
      kind: 'saved',
      decision: { kind: 'rejected', error: { code: 'not_found' } },
    } as Reply),
    'Set fact refused: no such fact in this cartridge.',
  );
  assert.equal(
    cheatNote('go_to_room', { kind: 'saved', decision: { kind: 'fault', code: 'x' } } as Reply),
    'Go to room refused: fault x.',
  );
  // Break: a lost ack, which may yet commit, reads as a refusal.
  assert.equal(
    cheatNote('set_fact', { kind: 'pending' } as Reply),
    'Set fact not confirmed: pending.',
  );
});

// Break: a cheat sent mid catch-up is held by the session, lands on a later pulse and is never recorded.
test('a cheat waits for the time due and is not sent while it is undelivered', () => {
  const { game, sent } = session({}, [accepted]);
  const m = { id: 'c', version: '1' };
  const stuck = { ...game, pulse: () => ({ kind: 'catching_up' }) };
  assert.equal(
    sendCheat(stuck, { op: 'go_to_room', room: 'well' }, m),
    'Not sent, the game is still catching up: catching_up.',
  );
  assert.equal(sent.length, 0);
  assert.equal(sendCheat(game, { op: 'go_to_room', room: 'well' }, m), '');
  assert.equal(sent.length, 1);
});

// A session that holds: `pending` until told otherwise; `pulsed` is what a pulse delivers.
function holding(replies: Reply[]) {
  const steps: Step[] = [];
  let pending = false;
  let listener: (u: { kind: string; reply?: Reply }) => void = () => {};
  const game = {
    invoke: (_: Intent) => {
      const next = replies.shift();
      if (!next) throw new Error('disk');
      if (next !== waiting) pending = false; // a later invoke settles the held attempt
      return next;
    },
    entityIds: () => ({ [NPC]: 'a1' }),
    pending: () => pending,
    subscribe: (l: typeof listener) => (listener = l),
  };
  const set = (p: boolean) => (pending = p);
  const invoke = recording(game, (s) => steps.push(s));
  return {
    steps,
    invoke,
    set,
    complete: (reply: Reply) => listener({ kind: 'completion', reply }),
  };
}
const waiting = { kind: 'catching_up' } as unknown as Reply;

test('a held input is recorded when it settles, once, as sent', () => {
  // Break (panel.tsx before this): only the reply to invoke was read, so a held input was lost.
  const h = holding([waiting]);
  h.set(true);
  h.invoke(intent(['a1']));
  assert.deepEqual(h.steps, []);
  h.set(false);
  h.complete(accepted);
  assert.deepEqual(h.steps, [{ intent: intent([NPC]) }]);
  h.complete(accepted); // Break: a completion with nothing held records a step
  assert.equal(h.steps.length, 1);
});

test('an invoke answered while another is held records the held input, not its own', () => {
  // Break: the second, ignored intent is recorded in place of the one the session ran.
  const h = holding([waiting, accepted]);
  h.set(true);
  h.invoke(intent(['a1'], { n: 1 }));
  h.invoke(intent(['a1'], { n: 2 }));
  assert.deepEqual(h.steps, [{ intent: intent([NPC], { n: 1 }) }]);
});

test('an input that threw and is not held does not replace the next', () => {
  // Break: the thrown intent stays held, so the next accepted step records the wrong input.
  const replies: Reply[] = [];
  const h = holding(replies);
  assert.throws(() => h.invoke(intent(['a1'], { n: 1 })), /disk/);
  replies.push(accepted);
  h.invoke(intent(['a1'], { n: 2 }));
  assert.deepEqual(h.steps, [{ intent: intent([NPC], { n: 2 }) }]);
});

test('a refused input leaves no step and holds nothing into the next', () => {
  // Breaks: a refusal recorded; the refused intent still held when the next is accepted.
  const h = holding([refused, accepted]);
  h.invoke(intent(['a1'], { n: 1 }));
  assert.deepEqual(h.steps, []);
  h.invoke(intent(['a1'], { n: 2 }));
  assert.deepEqual(h.steps, [{ intent: intent([NPC], { n: 2 }) }]);
});

test('a write that throws and leaves the input held is recorded when it settles', () => {
  // Break: the throw drops the held input (invocation.ts: the attempt stays pending).
  const h = holding([]);
  h.set(true);
  assert.throws(() => h.invoke(intent(['a1'])));
  h.set(false);
  h.complete(accepted);
  assert.deepEqual(h.steps, [{ intent: intent([NPC]) }]);
});

test('an advance is delivered and recorded only if delivered', () => {
  // Breaks: a reload loses a delivered advance (recorded late or never); a refused one is recorded.
  const moved: number[] = [];
  const steps: Step[] = [];
  const pulses: string[] = [];
  const delivered = {
    pulse: (mode: 'active' | 'drain') => (pulses.push(mode), { kind: 'ready' }),
  };
  assert.equal(
    advanced(
      60,
      (ms) => moved.push(ms),
      delivered,
      (s) => steps.push(s),
    ),
    undefined,
  );
  assert.deepEqual([moved, steps, pulses], [[60], [{ advance: 60 }], ['active', 'drain']]);
  const stuck = { pulse: () => ({ kind: 'failed', code: 'write' }) };
  assert.equal(
    advanced(
      5,
      () => {},
      stuck,
      (s) => steps.push(s),
    ),
    'Advance: failed write; not recorded.',
  );
  assert.equal(steps.length, 1);
});
