// Keep my place (docs/system/cartridge.md#author-preview): the author preview records the inputs
// the session saved under the artifact hash and, after a reload into a different artifact, sends
// them again through the normal command path. Targets are kept as definition refs because entity
// ids shift when an edit adds or removes an entity. Nothing here writes state directly.
import type { EntityId, GameView, Intent, Reply } from '../../packages/game-view/session.ts';

export type Step = { intent: Intent } | { advance: number }; // advance: dev-clock milliseconds
// stopped: a replay stopped under this artifact; its save already holds the path up to there.
export type Place = {
  hash: string;
  steps: Step[];
  stopped?: { hash: string; at?: number; note: string };
};
type Ids = Readonly<Record<string, string>>; // definition ref -> entity id
type Pulsed = {
  pulse: (mode: 'active' | 'drain') => { kind: string; code?: string; message?: string };
};
export type Replayable = Pulsed & {
  view: () => { view: Pick<GameView, 'choice'>; token: string };
  invoke: (intent: Intent) => Reply;
  entityIds: () => Ids;
};
// refused: the game or the file said no to this step, so dropping it can help; a pending or fault reply is not that.
export type Outcome = { done: number; failed?: string; refused?: true };
/** After the dev clock moved: credit the elapsed time now, so the next replayed input is not refused as catching up. Returns how the delivery ended. */
export function caughtUp(game: Pulsed) {
  game.pulse('active'); // a drain never captures the clocks (elapsed.ts pulse); an active pulse does
  let rounds = 0;
  let last = game.pulse('drain');
  while (++rounds < 1000 && last.kind === 'catching_up') last = game.pulse('drain');
  const why = last.code ?? last.message;
  return why ? `${last.kind} ${why}` : last.kind;
}

/** The dev clock moved by `ms`, delivered now and recorded only if delivered; else what stopped it. */
export function advanced(
  ms: number,
  moveClock: (ms: number) => void,
  game: Pulsed,
  keep: (step: Step) => void,
) {
  moveClock(ms);
  const how = caughtUp(game);
  if (how !== 'ready') return `Advance: ${how}; not recorded.`;
  keep({ advance: ms });
}

/**
 * The dev cartridge's host clocks, the same in the author preview and `bin/loka check`: they move
 * only with the dev clock, so a recording replays alike in both.
 */
export const frozenClock = (moved: () => number) => ({
  wall: () => 10_000 + moved(), // any start reads the same: only the deltas matter
  monotonic: moved,
});

const isRef = (target: string) => target.includes('@');

/** The intent with each defined target named by its ref; a runtime-born entity keeps its id. */
export const asRefs = (intent: Intent, ids: Ids): Intent => ({
  ...intent,
  target_ids: intent.target_ids.map(
    (id) => (Object.keys(ids).find((ref) => ids[ref] === id) ?? id) as EntityId,
  ),
});

type Recorded = {
  invoke: (intent: Intent) => Reply;
  entityIds: () => Ids;
  pending: () => boolean;
  subscribe: (update: (u: { kind: string; reply?: Reply }) => void) => unknown;
};
/**
 * `game.invoke` recording each accepted input once. The session may hold an input (invocation.ts):
 * it settles on a later pulse, and until then any other invoke is answered with the held input's
 * reply, so what is recorded is the held input, not the latest sent.
 */
export function recording(game: Recorded, keep: (step: Step) => void) {
  let held: Intent | undefined;
  const settle = (reply: Reply) => {
    if (reply.kind === 'saved' && reply.decision.kind === 'accepted' && held)
      keep({ intent: held });
    if (!game.pending()) held = undefined;
  };
  game.subscribe((u) => {
    if (u.kind === 'completion' && u.reply) settle(u.reply);
  });
  return (intent: Intent) => {
    if (!game.pending()) held = undefined; // a throw that left nothing held
    held ??= asRefs(intent, game.entityIds()); // before the action eats, gives away or kills its target
    const reply = game.invoke(intent); // a throw (the write failed) leaves the attempt held
    settle(reply);
    return reply;
  };
}

const describe = (reply: Reply) => {
  if (reply.kind !== 'saved') return reply.kind;
  const d = reply.decision;
  return d.kind === 'rejected'
    ? `rejected ${d.error.code}`
    : d.kind === 'fault'
      ? `fault ${d.code}`
      : d.kind;
};

/** The panel's dev-only ask (docs/system/cartridge.md#author-preview), by definition key. */
export type Cheat =
  | { op: 'go_to_room'; room: string }
  | { op: 'set_fact'; fact: string; value: boolean | number | string };

/** A cheat as the ordinary invocation the session decides and records. */
export function cheatIntent(
  cheat: Cheat,
  { id, version }: { id: string; version: string },
  token: string,
): Intent {
  const ref = (kind: string, key: string) => ({
    cartridge_id: id,
    cartridge_version: version,
    kind,
    key,
  });
  return {
    action_key: cheat.op === 'go_to_room' ? 'dev_go_to_room' : 'dev_set_fact',
    target_ids: [],
    input:
      cheat.op === 'go_to_room'
        ? { room: ref('room', cheat.room) }
        : { fact: ref('fact', cheat.fact), value: cheat.value },
    view_freshness_token: token,
  } as unknown as Intent;
}

const REFUSED: Record<Cheat['op'], Record<string, string>> = {
  go_to_room: {
    not_found: 'no such room in this cartridge',
    invalid_state:
      'already there, the room is underwater, or in a fight, not standing, in water, riding, escorting, leading a group, on a patrol or expedition, in a scene, at an open choice or before the ancestry choice; finish that first',
  },
  set_fact: {
    not_found: 'no such fact in this cartridge',
    invalid_state:
      'already that value, the wrong type or range, per subject, owned by a mechanic, or the ancestry choice is still open',
  },
};

/** The author's plain words for a cheat's reply; empty when it was accepted. */
export function cheatNote(op: Cheat['op'], reply: Reply) {
  if (reply.kind === 'saved' && reply.decision.kind === 'accepted') return '';
  const code =
    reply.kind === 'saved' && reply.decision.kind === 'rejected' && reply.decision.error.code;
  return `${op === 'go_to_room' ? 'Go to room' : 'Set fact'} ${reply.kind === 'pending' ? 'not confirmed' : 'refused'}: ${(code && REFUSED[op][code]) || describe(reply)}.`;
}

/**
 * Sends a cheat once the time due is delivered: a reply held for catch-up would land on a later pulse,
 * unrecorded and after the author read it as refused. Returns the note.
 */
export function sendCheat(
  game: Replayable,
  cheat: Cheat,
  manifest: { id: string; version: string },
) {
  const after = caughtUp(game);
  if (after !== 'ready') return `Not sent, the game is still catching up: ${after}.`;
  return cheatNote(cheat.op, game.invoke(cheatIntent(cheat, manifest, game.view().token)));
}

/** The path without the step at `index`. */
export const dropStep = (steps: Step[], index: number) => steps.filter((_, i) => i !== index);

/** Sends one recorded input; `done` is filled by the caller. */
function send(i: number, intent: Intent, game: Replayable): Omit<Outcome, 'done'> | undefined {
  const ids = game.entityIds();
  const { direction } = intent.input;
  const said = [intent.action_key, ...intent.target_ids, ...(direction ? [direction] : [])];
  const name = `step ${i + 1} (${said.join(' ')})`;
  const missing = intent.target_ids.find((t) => isRef(t) && !(t in ids));
  if (missing) return { failed: `${name}: no ${missing} in this cartridge`, refused: true };
  const { view, token } = game.view();
  // A choice names its continuation, which this run issued afresh.
  const input =
    intent.input.continuation_id && view.choice
      ? { ...intent.input, continuation_id: view.choice.continuation_id }
      : intent.input;
  const reply = game.invoke({
    ...intent,
    target_ids: intent.target_ids.map((t) => (ids[t] ?? t) as EntityId),
    input,
    view_freshness_token: token,
  });
  if (reply.kind === 'saved' && reply.decision.kind === 'accepted') return undefined;
  return {
    failed: `${name}: ${describe(reply)}`,
    ...(reply.kind === 'saved' && reply.decision.kind === 'rejected' && { refused: true }),
  };
}

/** Exactly one of advance and intent, and an intent `send` can read: this is hand-edited JSON. */
const wellFormed = (step: Step | null) =>
  typeof step === 'object' &&
  !!step &&
  'advance' in step !== 'intent' in step &&
  ('advance' in step ||
    (!!step.intent?.input &&
      Array.isArray(step.intent.target_ids) &&
      step.intent.target_ids.every((t) => typeof t === 'string')));

/** Sends the steps in order; the first the session does not save and accept stops the replay, named. */
export function replay(steps: Step[], game: Replayable, moveClock: (ms: number) => void): Outcome {
  for (const [i, step] of steps.entries()) {
    if (!wellFormed(step))
      return {
        done: i,
        failed: `step ${i + 1}: not a step (needs advance or intent, not both)`,
        refused: true,
      };
    if ('advance' in step) {
      const name = `step ${i + 1} (advance ${step.advance})`;
      if (!Number.isSafeInteger(step.advance) || step.advance < 0)
        return { done: i, failed: `${name}: not whole milliseconds`, refused: true };
      moveClock(step.advance);
      const after = caughtUp(game);
      if (after !== 'ready') return { done: i, failed: `${name}: ${after}` };
      continue;
    }
    const stopped = send(i, step.intent, game);
    if (stopped) return { done: i, ...stopped };
  }
  return { done: steps.length };
}
