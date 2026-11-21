// Build mode's ghost lines (docs/rnd/in-game-builder-mode-2026-11-19.md §4.5): what the compiled
// cartridge places in this room that the view does not draw, each with why. Pure; dev only. The
// reasons are builder chrome, placeholder words the owner replaces.
import type { DefinitionRef, GameView, Policy } from '../src/contracts.gen.ts';
import { refString } from '../src/runtime/decision.ts';
import { sentences } from './why_words.ts';

type Ref = { cartridge_id: string; cartridge_version: string; kind: string; key: string };
type Def = { key: string; name?: string; policy?: Policy };
/** The compiled cartridge's records a ghost reads, each keyed by its ref string. */
export type Cartridge = {
  npcs?: Record<string, Def & { room?: Ref; perception?: { discovered: Ref } }>;
  items?: Record<string, Def & { location: { in: string; room?: Ref } }>;
  rooms?: Record<string, { key: string; variants?: { when: Policy; description: string }[] }>;
  scripted_actions?: Record<string, Def & { target?: { kind: string; room?: Ref } }>;
  dialogues?: Record<string, Dialogue>;
};
type Dialogue = Def & {
  npc: Ref;
  prompt?: string;
  entry?: boolean;
  choices?: Record<string, Next>;
};
type Next = { then?: string; then_failed?: string };
export type Ghost = {
  kind: 'npc' | 'item' | 'variant' | 'action' | 'dialogue';
  key: string; // the definition's key; a variant's is the room's
  ref: string; // the definition's ref string (a variant's, the room's)
  words: string; // the text key the line draws
  reason: string;
};
export const NOT_HERE = 'not here now';
export const NOT_OFFERED = 'not offered now';
const when = (policy?: Policy, otherwise = NOT_HERE) =>
  policy
    ? `only when: ${sentences({ policy })
        .map((r) => r.text)
        .join('; ')}`
    : otherwise;

type Seen = { seen: (ref: string) => boolean; offered: (key: string) => boolean };
const list = <T>(r?: Record<string, T>) => Object.entries(r ?? {});

/** The ghost lines of room `here` (its key): people and items placed here the view lacks, the room's
 * variants not in force, the detail actions here the view does not offer, and the ways into talk
 * with someone drawn who offers none. `ids` is the game's entity id per ref string. */
export function ghosts(
  view: GameView,
  cartridge: Cartridge,
  here: string,
  ids: Readonly<Record<string, string>>,
): Ghost[] {
  // A talk is offered on its person, a detail action on its notice, the rest on the place.
  const notices = [
    ...(view.notices ?? []),
    ...(view.notice_boards ?? []).flatMap((b) => b.notices),
  ];
  const keys = new Set<string>(
    [view.actions, ...[...view.entities, ...notices].map((o) => o.actions ?? [])]
      .flat()
      .map((a) => a.action_key),
  );
  const at: Seen = {
    seen: (ref) => view.entities.some((e) => e.id === ids[ref]),
    offered: (key) => keys.has(key),
  };
  const shown = view.place.description.key;
  return [
    ...placed(cartridge, here, at),
    ...variants(cartridge, here, shown),
    ...unoffered(cartridge, here, at),
  ];
}

function placed(c: Cartridge, here: string, { seen }: Seen): Ghost[] {
  const people = list(c.npcs)
    .filter(([ref, n]) => n.room?.key === here && !seen(ref))
    .map(([ref, n]): Ghost => {
      const gate = n.perception?.discovered.key;
      const reason = gate ? `hidden: until fact ${gate}` : NOT_HERE;
      return { kind: 'npc', key: n.key, ref, words: n.name ?? n.key, reason };
    });
  const things = list(c.items)
    .filter(([ref, i]) => i.location.in === 'room' && i.location.room?.key === here && !seen(ref))
    .map(([ref, i]): Ghost => ({
      kind: 'item',
      key: i.key,
      ref,
      words: i.name ?? i.key,
      reason: NOT_HERE,
    }));
  return [...people, ...things];
}

/** The room's variants whose words are not the ones drawn: none of them is in force. */
const variants = (c: Cartridge, here: string, shown: string) =>
  list(c.rooms)
    .filter(([, r]) => r.key === here)
    .flatMap(([ref, r]) =>
      (r.variants ?? [])
        .filter((v) => v.description !== shown)
        .map((v): Ghost => ({
          kind: 'variant',
          key: here,
          ref,
          words: v.description,
          reason: when(v.when),
        })),
    );

function unoffered(c: Cartridge, here: string, { seen, offered }: Seen): Ghost[] {
  const actions = list(c.scripted_actions)
    .filter(
      ([, a]) => a.target?.kind === 'detail' && a.target.room?.key === here && !offered(a.key),
    )
    .map(([ref, a]): Ghost => ({
      kind: 'action',
      key: a.key,
      ref,
      words: a.name ?? a.key,
      reason: when(a.policy),
    }));
  // A drawn speaker offers one talk, and only a way in (not `entry: false`, no answer leads to it).
  const all = list(c.dialogues);
  const named = new Set(
    all.flatMap(([, d]) => Object.values(d.choices ?? {}).flatMap((x) => [x.then, x.then_failed])),
  );
  const speaker = (d: Dialogue) => refString(d.npc as DefinitionRef);
  const talking = new Set(all.filter(([, d]) => offered(d.key)).map(([, d]) => speaker(d)));
  const talks = all
    .filter(
      ([, d]) =>
        seen(speaker(d)) && !talking.has(speaker(d)) && d.entry !== false && !named.has(d.key),
    )
    .map(([ref, d]): Ghost => ({
      kind: 'dialogue',
      key: d.key,
      ref,
      words: d.name ?? d.prompt ?? d.key,
      reason: when(d.policy, NOT_OFFERED),
    }));
  return [...actions, ...talks];
}
