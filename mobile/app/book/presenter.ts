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
function said(r: Reply, text: Say, view: GameView): string {
  if (r.kind === 'pending') return '(pending: not confirmed saved; press any button to retry it)';
  if (r.kind === 'stale_view') return 'The page had changed; here it is again.';
  if (r.kind !== 'saved') return `(${r.kind}${'code' in r ? ` ${r.code}` : ''})`;
  const d = r.decision;
  if (d.kind === 'rejected') {
    const { code } = d.error; // the same sentence as a refused drag (model.ts `refused`)
    return SENTENCE[code] ?? `You can't do that: ${reason(code)}.`;
  }
  if (d.kind === 'fault') return '';
  const lines = d.narration ?? [];
  const shown = ['looked', 'moved'].includes(d.outcome) ? withoutHeading(lines, view) : lines;
  return shown.map((t) => text(t.key)).join(' ') || (OUTCOME[d.outcome] ?? '');
}

// A press answers in its world or NPC detail log; genuine same-room NPC arrivals/departures remain.
// Returns the answer line (none: ''). A look says nothing: its fresh
// page is the answer. ponytail: a look that settles a shown pending leaves that pending line above
// (the status line's "save not confirmed" still clears).
function answer(log: string[], reply: Reply, text: Say, comings: string[], view: GameView): string {
  const line = said(reply, text, view);
  if (line) log.push(line);
  log.push(...comings);
  return line;
}

// Navigation adds no duplicate heading. NPCs that leave or arrive while the player stays put
// still have a meaningful status line. ponytail: inferred from the view; kernel schedule narration replaces it.
function comings(was: GameView, now: GameView, text: Say): string[] {
  if (was.place.id !== now.place.id) return [];
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

// Compare structured TextKeys, never rendered English. Authored non-navigation consequences stay.
const withoutHeading = <T extends { key: string }>(lines: readonly T[], view: GameView) =>
  lines.filter((t) => t.key !== view.place.title.key && t.key !== view.place.description?.key);

type Logs = {
  log: string[];
  details: Map<string, string[]>;
  retry?: { label: string; detail?: string };
  fault?: string;
};

function restoredLogs(game: Game, text: Say): Logs {
  const last = game.lastNarration();
  const { view } = game.view();
  const restored = last
    ? withoutHeading(last.lines, view)
        .map((t) => text(t.key))
        .join(' ')
    : '';
  const log = restored && !view.choice ? [restored] : [];
  const details = new Map<string, string[]>();
  if (restored && view.choice) details.set(view.choice.speaker_id ?? 'conversation', [restored]);
  return { log, details };
}

function pressed(game: Game, b: Button, detail: string | undefined, s: Logs, text: Say): string {
  const was = game.view().view;
  s.retry ??= { label: b.label, detail };
  let lines = s.log;
  if (s.retry.detail) {
    if (!s.details.has(s.retry.detail)) s.details.set(s.retry.detail, []);
    lines = s.details.get(s.retry.detail)!;
  }
  let reply: Reply;
  try {
    reply = game.invoke(intentOf(b));
  } catch (e) {
    s.fault = (e as Error).message;
    const line = `(not confirmed: ${s.fault}; the next press retries ${s.retry.label})`;
    lines.push(line);
    return line;
  }
  s.fault = undefined;
  if (!game.pending()) s.retry = undefined;
  const now = game.view().view;
  if (was.place.id !== now.place.id) lines = s.log;
  return answer(lines, reply, text, comings(was, now, text), now);
}

/** World/detail logs, buttons and presses for one game. */
export function presenter(game: Game) {
  const { text, label } = sayers(game);
  const s = restoredLogs(game, text);
  return {
    screen: () => {
      s.log.splice(0, s.log.length - 200);
      for (const lines of s.details.values()) lines.splice(0, lines.length - 200);
      const { view, token } = game.view();
      const buttons: Button[] = buttonsOf(view, label, text).map((b) => ({ ...b, token }));
      return {
        view,
        text,
        buttons,
        log: s.log,
        detail: (id: string) => s.details.get(id) ?? [],
        pending: game.pending(),
        fault: s.fault,
      };
    },
    // A pending retry keeps the original detail, even when retried from the world.
    press: (b: Button, detail?: string) => pressed(game, b, detail, s, text),
    startOverFailed(why?: string) {
      if (why !== undefined) s.log.push(`(start over: ${why})`);
    },
  };
}
