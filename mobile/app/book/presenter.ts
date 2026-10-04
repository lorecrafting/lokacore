// The book's words and state over a Game (packages/game-view/session.ts): the offered actions as
// buttons, the log of what each press said, and who came or went. The engine returns structured
// results; every sentence here is the app's own (docs/decisions/owner-decision-presenter-split-
// 2026-10-02.md). Plain TypeScript, so any view can replace the React one. It adds no mechanics.
import type {
  ActionInput,
  EntityId,
  Game,
  GameView,
  Intent,
  Key,
  Reply,
} from '../../packages/game-view/session.ts';
import { OUTCOME, reason, SENTENCE } from './words.ts';
import { things } from './model.ts';

/**
 * A tappable action: its text and the intent it sends (the session adds id and actor), with the
 * view freshness token of the screen it was drawn from (04 §16), never the token at the press.
 */
export type Button = {
  label: string;
  action_key: string;
  target_ids: string[];
  input: object;
  token?: string; // none: no freshness check (a test's hand-made button)
};

type Say = (key: string) => string;
type Press = Omit<Button, 'token'>;

// The pending choice's available answers and its Close (06 §43: never a trap).
function asked(v: GameView, label: Say): Press[] {
  const c = v.choice;
  const answer = (o: { choice_id: string; label: string }) => ({
    label: label(o.label),
    action_key: 'choose',
    target_ids: [],
    input: { choice_id: o.choice_id, continuation_id: c!.continuation_id },
  });
  return [
    ...(c?.choices.filter((o) => o.available) ?? []).map(answer),
    ...(c?.closable
      ? [{ label: 'Close', action_key: 'close_choice', target_ids: [], input: {} }]
      : []),
  ];
}

// The view's available actions as buttons: place actions that need no input, each open exit as a
// move, each entity's or held item's actions aimed at it, then the pending choice's.
function buttonsOf(v: GameView, label: Say, text: Say): Press[] {
  const button = (a: { action_key: string; label: string }, name: string, id?: string) => ({
    label: `${label(a.label)}${name}`,
    action_key: a.action_key,
    target_ids: id ? [id] : [],
    input: {},
  });
  const place = v.actions.filter((a) => a.available && !a.input.length && a.target.kind === 'none');
  const moves = v.exits.filter((e) => e.available);
  const doors = v.exits.flatMap((e) =>
    (e.door?.actions ?? [])
      .filter((a) => a.available)
      .map((a) => ({
        ...button(a, ` ${text(e.door!.name)} (${e.direction})`),
        input: { direction: e.direction },
      })),
  );
  const held = things(v).flatMap((e) =>
    e.actions.filter((a) => a.available).map((a) => button(a, ` ${text(e.name)}`, e.id)),
  );
  return [
    ...place.map((a) => button(a, '')),
    ...moves.map((e) => ({
      label: `Go ${e.direction}`,
      action_key: 'move',
      target_ids: [],
      input: { direction: e.direction },
    })),
    ...doors,
    ...held,
    ...asked(v, label),
  ];
}

// What one press answers: the narration or the outcome's words (words.ts; none: '') of an accepted
// command, else the refusal in words. Never a raw outcome code.
function said(r: Reply, text: Say): string {
  if (r.kind === 'pending') return '(pending: not confirmed saved; press any button to retry it)';
  if (r.kind === 'stale_view') return 'The page had changed; here it is again.';
  if (r.kind !== 'saved') return `(${r.kind}${'code' in r ? ` ${r.code}` : ''})`;
  const d = r.decision;
  if (d.kind === 'rejected') {
    const { code } = d.error; // the same sentence as a refused drag (model.ts `refused`)
    return SENTENCE[code] ?? `You can't do that: ${reason(code)}.`;
  }
  if (d.kind === 'fault') return '';
  return d.narration?.map((t) => text(t.key)).join(' ') || (OUTCOME[d.outcome] ?? '');
}

// The log after a press: its answer if it has words, then the new place's name or who came or went.
// Returns the answer line (none: ''), which the NPC menu shows too. A look says nothing: its fresh
// page is the answer. ponytail: a look that settles a shown pending leaves that pending line above
// (the status line's "save not confirmed" still clears).
function answer(log: string[], reply: Reply, text: Say, comings: string[]): string {
  const line = said(reply, text);
  if (line) log.push(line);
  log.push(...comings);
  return line;
}

// After a move, the new place's name: its room log's heading. Else the NPCs that left or arrived
// while the player stayed put. ponytail: inferred from the view; kernel schedule narration replaces it.
function comings(was: GameView, now: GameView, text: Say): string[] {
  if (was.place.id !== now.place.id) return [text(now.place.title.key)];
  const gone = (a: GameView, b: GameView) =>
    a.entities.filter((e) => e.kind === 'npc' && !b.entities.some((f) => f.id === e.id));
  return [
    ...gone(was, now).map((e) => `${text(e.name)} leaves.`),
    ...gone(now, was).map((e) => `${text(e.name)} arrives.`),
  ];
}

// A text key's words, and an action label's. ponytail: the cartridge has no text for most action
// labels yet, so a label shows the key's last word, capitalised as the texted labels are.
const sayers = (g: Game): { text: Say; label: Say } => ({
  text: (key) => g.text(key) ?? key,
  label: (key) =>
    g.text(key) ??
    key
      .replace(/^actions?\./, '')
      .replaceAll('_', ' ')
      .replace(/^./, (a) => a.toUpperCase()),
});

// The button's plain strings are the wire's branded ones: a button is built from the view's own keys.
const intentOf = ({ action_key, target_ids, input, token }: Button): Intent => ({
  action_key: action_key as Key,
  target_ids: target_ids as EntityId[],
  input: input as ActionInput,
  ...(token && { view_freshness_token: token }),
});

/** The log, the buttons and the press of one Game; one per game being played. */
export function presenter(game: Game) {
  const { text, label } = sayers(game);
  // The log's start: the last committed narration again, so a reopen (a crash before display too)
  // shows it (06 §43).
  const last = game.lastNarration();
  const log = last ? [last.lines.map((t) => text(t.key)).join(' ')] : [];
  // The label of the unconfirmed press, which any press retries: the fault line names it.
  let retry: string | undefined;
  let fault: string | undefined; // the last press's throw, shown with start over beside the retry
  return {
    screen: () => {
      log.splice(0, log.length - 200); // ponytail: the last 200 lines, Book's too
      const { view, token } = game.view();
      const buttons: Button[] = buttonsOf(view, label, text).map((b) => ({ ...b, token }));
      return { view, text, buttons, log, pending: game.pending(), fault };
    },
    /** Returns what the press said (none: ''), for the NPC menu. */
    press(b: Button): string {
      const was = game.view().view; // the view before, for who came or went
      retry ??= b.label;
      let reply: Reply;
      try {
        reply = game.invoke(intentOf(b));
      } catch (e) {
        // A throw may follow a durable commit: the session keeps the attempt; a resend replays it.
        fault = (e as Error).message;
        const line = `(not confirmed: ${fault}; the next press retries ${retry})`;
        log.push(line);
        return line;
      }
      fault = undefined;
      if (!game.pending()) retry = undefined;
      return answer(log, reply, text, comings(was, game.view().view, text));
    },
    /** A start over that failed and kept this game says why in the log (none: it did not fail). */
    startOverFailed(why?: string) {
      if (why !== undefined) log.push(`(start over: ${why})`);
    },
  };
}
