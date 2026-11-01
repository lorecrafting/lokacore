// A page's Pick lists (book-ui.md, Pick a second thing): its use and Give pairs (buttons.ts), one
// option per side of the pair this page is on, each row named by the pair's other object.
import { LABEL } from './labels.ts';
import { cap, type Thing } from './model.ts';
import { commandOf } from './buttons.ts';
import type { GameView } from '../../packages/game-view/session.ts';
import { things } from './item-pages.ts';
import type { Button } from './presenter.ts';
import { lower } from './words.ts';

export type Row = { b: Button; label: string; name: string; note?: string } | Refused;
type Refused = { label: string; reason: string };
export type Pick = { label: string; rows: Row[] };

// A use pair is [target, tool], a Give pair [item, person]: the option for this page's place in it.
const OPTION = { use: [LABEL.useAnItem, LABEL.useOn], give: [LABEL.giveTo, LABEL.giveAnItem] };

/** The pair as words: "quench a cart" (after "You ", the fallback line adds "with" and the tool). */
export const phrase = (b: Button, name: (id: string) => string) =>
  commandOf(b) === 'cast'
    ? `cast ${lower(b.label)} on ${name(b.target_ids[0]!)}`
    : commandOf(b) === 'give'
      ? `give ${name(b.target_ids[0]!)} to ${name(b.target_ids[1]!)}`
      : `${lower(b.label)} ${name(b.target_ids[0]!)}`;

// An amount as prose, never a count (book-ui.md Line placement), with no closing stop: exact 0 and
// exact capacity only ever read empty and full; a third or less nearly empty, two thirds or more
// nearly full. `of` names what fills it ("water", "fuel").
export const amountWords = (quantity: number, capacity: number, of: string) => {
  if (quantity <= 0) return 'Empty';
  if (quantity >= capacity) return `Full of ${of}`;
  if (3 * quantity >= 2 * capacity) return `Nearly full of ${of}`;
  if (3 * quantity <= capacity) return `Nearly empty, a little ${of} left`;
  return `Half full of ${of}`;
};

// A Fill, Pour or Drink line's level after it, from the line's own bindings (never today's view,
// so an old line keeps its level): " The waterskin is half full of water." (book-ui.md, Line
// placement). No vessel binding, or a vessel neither view names: nothing.
export const levelWords = (
  t: { bindings?: Record<string, unknown>; participants?: Record<string, unknown> },
  text: (key: string) => string,
  view: GameView,
  was?: GameView,
) => {
  const id = t.participants?.vessel;
  const { remaining, capacity, kind } = t.bindings ?? {};
  if (!id || typeof remaining !== 'number' || typeof capacity !== 'number') return '';
  const v = [view, was].map((g) => g && things(g).find((e) => e.id === id)).find(Boolean);
  if (!v) return '';
  // ponytail: with no name words, an indefinite short's article turns definite ("a skin" -> "the skin").
  const name = v.words
    ? `${v.words.article ? 'the ' : ''}${text(v.words.bare)}`
    : text(v.name).replace(/^(an?|some) /i, 'the ');
  return ` ${cap(name)} is ${lower(amountWords(remaining, capacity, lower(text(String(kind)))))}.`;
};

// A vessel's liquid: "Half full of water."
export const liquidWords = (
  l: { label: string; quantity: number; capacity: number },
  text: (key: string) => string,
) => `${amountWords(l.quantity, l.capacity, lower(text(l.label)))}.`;

// A twin row's quiet note: the item's projected state, as its detail page shows it (skills.tsx).
const state = (e: Thing | undefined, text: (key: string) => string) =>
  e?.state ? cap(e.state) : e?.liquid && liquidWords(e.liquid, text);

// The option a pair is listed under on page `id`. A spell: one list of spells on its target's page,
// elsewhere (Character) one list per spell.
const option = (b: Button, id: string) =>
  commandOf(b) !== 'cast'
    ? OPTION[commandOf(b) === 'give' ? 'give' : 'use'][b.target_ids.indexOf(id)]!
    : b.target_ids.includes(id)
      ? LABEL.castASpell
      : `${b.label}, ${lower(LABEL.castOn)}`;

export function picks(v: GameView, buttons: Button[], id: string, text: (key: string) => string) {
  const all = new Map<string, Thing>(things(v).map((e) => [e.id, e]));
  const name = (i: string) => text(all.get(i)?.name ?? '');
  const lists = new Map<string, Button[]>();
  for (const b of buttons.filter((b) => b.pick)) {
    lists.set(option(b, id), [...(lists.get(option(b, id)) ?? []), b]);
  }
  return [...lists].map(([label, pairs]): Pick => {
    const tool = label === LABEL.useOn;
    const end = (b: Button) => b.target_ids[b.target_ids[0] === id ? 1 : 0]!;
    const mixed = new Set(pairs.map((b) => b.action_key)).size > 1;
    const shown = (b: Button) =>
      label === LABEL.castASpell
        ? b.label
        : mixed
          ? `${b.label} ${label === LABEL.useAnItem ? 'with ' : ''}${name(end(b))}`
          : cap(name(end(b)));
    const rows = pairs.flatMap((b): Row[] => {
      const reason = b.pick!.reason;
      if (reason) return [{ label: tool ? b.label : shown(b), reason }];
      const twin = pairs.some((o) => o !== b && !o.pick!.reason && shown(o) === shown(b));
      const note = (twin && state(all.get(end(b)), text)) || undefined;
      // The name starts with the shown text, note included (label in name), so twins differ.
      const seen = note ? `${shown(b)} ${note}` : shown(b);
      return [{ b, label: shown(b), name: `${seen}, ${phrase(b, name)}`, note }];
    });
    // Under Use on…, a resting use is one row per scripted action, whatever its targets.
    return {
      label,
      rows: rows.filter(
        (r, i) =>
          !tool || 'b' in r || rows.findIndex((o) => !('b' in o) && o.label === r.label) === i,
      ),
    };
  });
}

// An authored line fills its bound slots; an unbound brace stays as written (level-rush rulings).
export const fillSlots = (
  said: string,
  bindings: Record<string, unknown> | undefined,
  word: (v: unknown) => string,
) =>
  said.replace(/\{(\w+)\}/g, (slot, k: string) =>
    bindings?.[k] === undefined ? slot : word(bindings[k]),
  );
