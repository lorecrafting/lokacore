// The Step tab's report: what the last step changed and which rules looked at it, per
// docs/design/story-tooling.md §D1. The facts and quests come from the two views the panel already
// holds (its last two `state` messages, no engine work); the reaction rows are the explainer's
// (kernel/ts/play/why.ts), and a failing leaf is worded by why_words.ts so the two cannot drift.
import { sentences, type Row } from '../../../kernel/ts/play/why_words.ts';

/** The two views D1 compares: the Book's `state` before and after the step. */
export type Views = {
  facts?: readonly { row: string; key: string; value?: unknown; set?: boolean }[];
  quests?: readonly { quest: string; state: string }[];
};
export type Report = {
  ordinal: number;
  command: string;
  outcome: string;
  reactions: { rule: string; causes: unknown[]; fired: boolean; when?: unknown }[];
};

/** A view's fact value: a declared default (`set: false`) is its default value, so setting a fact off
 * its default reads as a change from that default, not from unset. */
const held = (f: { value?: unknown; set?: boolean }) => f.value ?? null;

/** Facts whose value changed, before → after. A row only the after view has is a new fact, not a change. */
export const changedFacts = (before: Views | undefined, after: Views | undefined) => {
  const was = new Map((before?.facts ?? []).map((f) => [f.row, held(f)]));
  return (after?.facts ?? [])
    .filter((f) => was.has(f.row) && JSON.stringify(held(f)) !== JSON.stringify(was.get(f.row)))
    .map((f) => ({ key: f.key, from: was.get(f.row) ?? null, to: held(f) }));
};

/** Quests whose state word changed, before → after. */
export const changedQuests = (before: Views | undefined, after: Views | undefined) => {
  const was = new Map((before?.quests ?? []).map((q) => [q.quest, q.state]));
  return (after?.quests ?? [])
    .filter((q) => was.has(q.quest) && was.get(q.quest) !== q.state)
    .map((q) => ({ quest: q.quest, from: was.get(q.quest)!, to: q.state }));
};

/** The report's reactions that matched a trigger; the explainer lists every rule, matched or not. */
export const looked = (r: Report | undefined) =>
  (r?.reactions ?? []).filter((x) => x.causes.length > 0);

/** A looked-at rule as one line: it fired, or the first `when` leaf that did not hold, in its words. */
export const lookedLine = (x: Report['reactions'][number]): Row =>
  x.fired
    ? { text: 'fired', ok: true, depth: 0 }
    : { text: firstFailing(x.when) ?? 'no when leaf held', ok: false, depth: 0 };

// The first leaf whose `held` is 0, depth-first in authoring order (why.ts annotates in that order).
// `held` is the number of deliveries at which that leaf held (why.ts `held`), so 0 is what failed, not false.
const firstFailing = (p: unknown): string | undefined => {
  const walk = (x: unknown): unknown => {
    if (!x || typeof x !== 'object') return undefined;
    const at = x as { held?: unknown; items?: unknown[]; item?: unknown };
    const kids = at.items ?? (at.item ? [at.item] : []);
    // a branch's own `held` is its children's, so only a leaf's says which condition failed
    if (!kids.length) return at.held === 0 ? x : undefined;
    for (const kid of kids) {
      const found = walk(kid);
      if (found) return found;
    }
    return undefined;
  };
  const leaf = walk(p);
  return leaf ? sentences({ policy: leaf })[0]?.text : undefined;
};

/** The two views of a step: the state before it and after it, keyed by the step it belongs to. */
export type Paired = { at?: string; before?: Views; after?: Views };

/**
 * Folds one `state` message into the pair. The Book posts on every update, so a message for the same
 * step is the same pair (a later render, not another step); a message at a new step moves after to before.
 */
export const pairViews = (seen: Paired, at: string, state: Views): Paired =>
  seen.at === at
    ? { ...seen, after: state }
    : { at, before: seen.after, after: state };
