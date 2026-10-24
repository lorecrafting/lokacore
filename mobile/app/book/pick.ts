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

// A twin row's quiet note: the item's projected state, as its detail page shows it (skills.tsx).
const state = (e: Thing | undefined, text: (key: string) => string) =>
  e?.state
    ? cap(e.state)
    : e?.liquid &&
      `${text(e.liquid.label)}: ${e.liquid.quantity}/${e.liquid.capacity} ${text(e.liquid.unit_label)}`;

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
    // Under Use on…, a resting use is one row per recipe, whatever its targets.
    return {
      label,
      rows: rows.filter(
        (r, i) =>
          !tool || 'b' in r || rows.findIndex((o) => !('b' in o) && o.label === r.label) === i,
      ),
    };
  });
}
